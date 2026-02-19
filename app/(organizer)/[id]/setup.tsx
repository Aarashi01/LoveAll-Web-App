import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Link, useLocalSearchParams } from 'expo-router';

import { useTournament } from '@/hooks/useTournament';
import { addPlayer, deletePlayer, subscribeToPlayers, updatePlayer } from '@/lib/firestore/players';
import {
  downloadTemplateExcel,
  parsePlayersWorkbookFromArrayBuffer,
  parsePlayersWorkbookFromBase64,
} from '@/lib/player-excel';
import { type MatchCategory, type PlayerDocument, type PlayerGender } from '@/lib/firestore/types';

const FALLBACK_CATEGORIES: MatchCategory[] = ['MS', 'WS', 'MD', 'WD', 'XD'];

export default function TournamentSetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tournament, loading: tournamentLoading, error: tournamentError } = useTournament(id);
  const [players, setPlayers] = useState<PlayerDocument[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<PlayerGender>('M');
  const [department, setDepartment] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<MatchCategory[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setPlayersLoading(false);
      return;
    }

    const unsubscribe = subscribeToPlayers(
      id,
      (nextPlayers) => {
        setPlayers(nextPlayers);
        setPlayersLoading(false);
      },
    );

    return unsubscribe;
  }, [id]);

  const enabledCategories = tournament?.categories ?? FALLBACK_CATEGORIES;

  const availablePartners = useMemo(
    () =>
      players.filter((player) => {
        if (player.partnerId) return false;
        if (!selectedCategories.some((category) => category === 'MD' || category === 'WD' || category === 'XD')) {
          return false;
        }
        return true;
      }),
    [players, selectedCategories],
  );

  const clearForm = () => {
    setName('');
    setGender('M');
    setDepartment('');
    setSelectedCategories([]);
    setPartnerId(null);
    setSeeded(false);
  };

  const toggleCategory = (category: MatchCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const handleAddPlayer = async () => {
    if (!id) return;
    setError(null);

    if (!name.trim()) {
      setError('Player name is required.');
      return;
    }

    if (selectedCategories.length === 0) {
      setError('Select at least one category.');
      return;
    }

    try {
      setSaving(true);
      const newPlayerId = await addPlayer(id, {
        name: name.trim(),
        gender,
        department: department.trim() || undefined,
        categories: selectedCategories,
        partnerId,
        seeded,
      });

      if (partnerId) {
        await updatePlayer(id, partnerId, { partnerId: newPlayerId });
      }

      clearForm();
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Failed to add player';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = async (type: 'singles' | 'doubles') => {
    try {
      await downloadTemplateExcel(type);
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Failed to download template';
      setError(message);
    }
  };

  const handleBulkImport = async () => {
    if (!id) return;
    setError(null);
    setImportSummary(null);

    try {
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setImporting(false);
        return;
      }

      const asset = result.assets[0];
      const parsed =
        Platform.OS === 'web'
          ? parsePlayersWorkbookFromArrayBuffer(
              await (asset.file
                ? asset.file.arrayBuffer()
                : fetch(asset.uri).then((response) => response.arrayBuffer())),
              enabledCategories,
            )
          : parsePlayersWorkbookFromBase64(
              await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
              }),
              enabledCategories,
            );

      if (parsed.players.length === 0) {
        setError('No valid player rows found in the uploaded file.');
        return;
      }

      const partnerTokens = new Map<string, string[]>();
      let added = 0;
      for (const imported of parsed.players) {
        const createdId = await addPlayer(id, {
          name: imported.name,
          gender: imported.gender,
          department: imported.department,
          categories: imported.categories,
          seeded: imported.seeded,
          partnerId: null,
          groupId: null,
        });
        added += 1;

        if (imported.partnerToken) {
          const ids = partnerTokens.get(imported.partnerToken) ?? [];
          ids.push(createdId);
          partnerTokens.set(imported.partnerToken, ids);
        }
      }

      for (const ids of partnerTokens.values()) {
        if (ids.length !== 2) continue;
        await updatePlayer(id, ids[0], { partnerId: ids[1] });
        await updatePlayer(id, ids[1], { partnerId: ids[0] });
      }

      const warningText =
        parsed.warnings.length > 0
          ? ` | Warnings: ${parsed.warnings.slice(0, 3).join(' ')}`
          : '';
      setImportSummary(
        `Imported ${added} players (${parsed.mode.toUpperCase()} mode detected).${warningText}`,
      );
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Bulk import failed';
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (player: PlayerDocument) => {
    if (!id) return;
    Alert.alert('Delete player?', `Remove ${player.name} from this tournament?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (player.partnerId) {
              await updatePlayer(id, player.partnerId, { partnerId: null });
            }
            await deletePlayer(id, player.id);
          } catch (value) {
            const message = value instanceof Error ? value.message : 'Delete failed';
            setError(message);
          }
        },
      },
    ]);
  };

  if (!id) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Missing tournament id.</Text>
      </SafeAreaView>
    );
  }

  if (tournamentLoading || playersLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{tournamentError ?? 'Tournament not found.'}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Player Setup</Text>
        <Text style={styles.meta}>{tournament.name}</Text>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        {importSummary ? <Text style={styles.successBanner}>{importSummary}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bulk Import (Excel)</Text>
          <Text style={styles.helpText}>
            Download a template, fill player rows in Excel, then upload. Import auto-detects singles vs doubles format.
          </Text>
          <View style={styles.templateActions}>
            <Pressable style={styles.templateButton} onPress={() => void handleDownloadTemplate('singles')}>
              <Text style={styles.templateButtonText}>Download Singles Template</Text>
            </Pressable>
            <Pressable style={styles.templateButton} onPress={() => void handleDownloadTemplate('doubles')}>
              <Text style={styles.templateButtonText}>Download Doubles Template</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.importButton, importing && styles.addButtonDisabled]}
            onPress={() => void handleBulkImport()}
            disabled={importing}
          >
            <Text style={styles.importButtonText}>{importing ? 'Importing...' : 'Upload Excel File'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Register Player</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter player name"
            style={styles.input}
          />

          <Text style={styles.label}>Department (optional)</Text>
          <TextInput
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g. Engineering"
            style={styles.input}
          />

          <Text style={styles.label}>Gender</Text>
          <View style={styles.segmented}>
            {(['M', 'F'] as PlayerGender[]).map((value) => (
              <Pressable
                key={value}
                style={[styles.segment, gender === value && styles.segmentActive]}
                onPress={() => setGender(value)}
              >
                <Text style={[styles.segmentText, gender === value && styles.segmentTextActive]}>
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Categories</Text>
          <View style={styles.chipsWrap}>
            {enabledCategories.map((category) => {
              const selected = selectedCategories.includes(category);
              return (
                <Pressable
                  key={category}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{category}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Seeded Player</Text>
            <Switch value={seeded} onValueChange={setSeeded} />
          </View>

          <Text style={styles.label}>Doubles Partner (optional)</Text>
          <View style={styles.partnerWrap}>
            <Pressable
              style={[styles.partnerOption, partnerId === null && styles.partnerOptionActive]}
              onPress={() => setPartnerId(null)}
            >
              <Text style={[styles.partnerText, partnerId === null && styles.partnerTextActive]}>
                No Partner
              </Text>
            </Pressable>
            {availablePartners.map((candidate) => (
              <Pressable
                key={candidate.id}
                style={[styles.partnerOption, partnerId === candidate.id && styles.partnerOptionActive]}
                onPress={() => setPartnerId(candidate.id)}
              >
                <Text style={[styles.partnerText, partnerId === candidate.id && styles.partnerTextActive]}>
                  {candidate.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.addButton, saving && styles.addButtonDisabled]}
            onPress={() => void handleAddPlayer()}
            disabled={saving}
          >
            <Text style={styles.addButtonText}>{saving ? 'Adding...' : 'Add Player'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Registered Players ({players.length})</Text>
          {players.length === 0 ? (
            <Text style={styles.emptyText}>No players added yet.</Text>
          ) : (
            players.map((player) => (
              <View key={player.id} style={styles.playerRow}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerMeta}>
                    {player.gender} | {player.categories.join(', ')}
                    {player.department ? ` | ${player.department}` : ''}
                  </Text>
                  {player.partnerId ? (
                    <Text style={styles.partnerMeta}>
                      Partner:{' '}
                      {players.find((candidate) => candidate.id === player.partnerId)?.name ?? 'Linked'}
                    </Text>
                  ) : null}
                </View>

                <Pressable style={styles.deleteButton} onPress={() => handleDelete(player)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Link href={{ pathname: '/(organizer)/[id]/schedule', params: { id } }} style={styles.nextLink}>
          Continue to Schedule
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F4F8',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F4F8',
    padding: 24,
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  meta: {
    marginTop: -6,
    color: '#64748B',
    fontWeight: '600',
  },
  errorText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  errorBanner: {
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontWeight: '700',
  },
  successBanner: {
    color: '#166534',
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  helpText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  templateActions: {
    gap: 8,
  },
  templateButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  templateButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12,
  },
  importButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#166534',
  },
  importButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#334155',
    fontWeight: '900',
    fontSize: 16,
  },
  label: {
    color: '#334155',
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  segmentText: {
    color: '#334155',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#1D4ED8',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  chipActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EAF2FF',
  },
  chipText: {
    color: '#334155',
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#1D4ED8',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  partnerWrap: {
    gap: 8,
  },
  partnerOption: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  partnerOptionActive: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  partnerText: {
    color: '#334155',
    fontWeight: '700',
  },
  partnerTextActive: {
    color: '#166534',
  },
  addButton: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F80ED',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  emptyText: {
    color: '#64748B',
    fontWeight: '700',
  },
  playerRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    color: '#0F172A',
    fontWeight: '900',
  },
  playerMeta: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  partnerMeta: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  deleteButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  nextLink: {
    color: '#FFFFFF',
    backgroundColor: '#166534',
    borderRadius: 10,
    textAlign: 'center',
    paddingVertical: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
});
