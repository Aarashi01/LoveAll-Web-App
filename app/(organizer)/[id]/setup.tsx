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
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Link, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { PlayerList } from '@/components/tournament/PlayerList';
import { theme, toCategoryLabel, toPlayerGenderLabel } from '@/constants/theme';
import { useTournament } from '@/hooks/useTournament';
import { addPlayer, deletePlayer, subscribeToPlayers, updatePlayer } from '@/lib/firestore/players';
import {
  downloadTemplateExcel,
  parsePlayersWorkbookFromArrayBuffer,
  parsePlayersWorkbookFromBase64,
} from '@/lib/player-excel';
import { type MatchCategory, type PlayerDocument, type PlayerGender } from '@/lib/firestore/types';

const FALLBACK_CATEGORIES: MatchCategory[] = ['MS', 'WS', 'MD', 'WD', 'XD'];

function isDoublesCategory(category: MatchCategory): boolean {
  return category === 'MD' || category === 'WD' || category === 'XD';
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isCategoryAllowedForGender(category: MatchCategory, gender: PlayerGender): boolean {
  if (category === 'XD') return true;
  if (gender === 'M') return category === 'MS' || category === 'MD';
  return category === 'WS' || category === 'WD';
}

function getCompatibleDoublesCategories(
  currentGender: PlayerGender,
  candidateGender: PlayerGender,
  currentCategories: MatchCategory[],
  candidateCategories: MatchCategory[],
): MatchCategory[] {
  const compatible: MatchCategory[] = [];

  currentCategories.forEach((category) => {
    if (!isDoublesCategory(category)) return;
    if (!candidateCategories.includes(category)) return;

    if (category === 'MD' && currentGender === 'M' && candidateGender === 'M') {
      compatible.push(category);
      return;
    }

    if (category === 'WD' && currentGender === 'F' && candidateGender === 'F') {
      compatible.push(category);
      return;
    }

    if (category === 'XD' && currentGender !== candidateGender) {
      compatible.push(category);
    }
  });

  return compatible;
}

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
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
  const selectedDoublesCategories = useMemo(
    () => selectedCategories.filter(isDoublesCategory),
    [selectedCategories],
  );
  const partnerSelectionEnabled = selectedDoublesCategories.length > 0;

  const editingPlayer = useMemo(
    () => players.find((player) => player.id === editingPlayerId) ?? null,
    [players, editingPlayerId],
  );

  const availablePartners = useMemo(
    () =>
      players.filter((player) => {
        if (editingPlayerId && player.id === editingPlayerId) return false;
        if (player.partnerId && player.partnerId !== editingPlayerId) return false;
        if (!partnerSelectionEnabled) {
          return false;
        }

        const compatibleCategories = getCompatibleDoublesCategories(
          gender,
          player.gender,
          selectedCategories,
          player.categories,
        );
        return compatibleCategories.length > 0;
      }),
    [editingPlayerId, gender, partnerSelectionEnabled, players, selectedCategories],
  );

  const filteredPlayers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return players;

    return players.filter((player) => {
      const baseText = [
        player.name,
        player.department ?? '',
        toPlayerGenderLabel(player.gender),
        ...player.categories.map(toCategoryLabel),
      ]
        .join(' ')
        .toLowerCase();

      return baseText.includes(query);
    });
  }, [players, searchQuery]);

  const seededCount = useMemo(() => players.filter((player) => player.seeded).length, [players]);
  const pairedCount = useMemo(
    () => players.filter((player) => Boolean(player.partnerId)).length,
    [players],
  );
  const availablePartnerIds = useMemo(
    () => new Set(availablePartners.map((candidate) => candidate.id)),
    [availablePartners],
  );

  const clearForm = () => {
    setName('');
    setGender('M');
    setDepartment('');
    setSelectedCategories([]);
    setPartnerId(null);
    setSeeded(false);
    setEditingPlayerId(null);
  };

  const toggleCategory = (category: MatchCategory) => {
    if (!isCategoryAllowedForGender(category, gender)) return;
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const handleStartEdit = (player: PlayerDocument) => {
    setError(null);
    setImportSummary(null);
    setEditingPlayerId(player.id);
    setName(player.name);
    setGender(player.gender);
    setDepartment(player.department ?? '');
    setSelectedCategories(player.categories);
    setPartnerId(player.partnerId);
    setSeeded(player.seeded);
  };

  const handleSavePlayer = async () => {
    if (!id) return;
    setError(null);
    setImportSummary(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Player name is required.');
      return;
    }

    if (selectedCategories.length === 0) {
      setError('Select at least one category.');
      return;
    }

    const normalized = normalizeName(trimmedName);
    const duplicate = players.find(
      (player) => normalizeName(player.name) === normalized && player.id !== editingPlayerId,
    );
    if (duplicate) {
      setError(`"${trimmedName}" already exists in the player list.`);
      return;
    }

    let resolvedPartnerId = partnerId;
    if (!partnerSelectionEnabled) {
      resolvedPartnerId = null;
    }

    if (resolvedPartnerId) {
      if (resolvedPartnerId === editingPlayerId) {
        setError('A player cannot be partnered with themselves.');
        return;
      }

      const partner = players.find((player) => player.id === resolvedPartnerId);
      if (!partner) {
        setError('Selected partner no longer exists. Please choose again.');
        return;
      }

      if (partner.partnerId && partner.partnerId !== editingPlayerId) {
        setError('Selected partner is already paired with another player.');
        return;
      }

      const compatibleCategories = getCompatibleDoublesCategories(
        gender,
        partner.gender,
        selectedCategories,
        partner.categories,
      );

      if (compatibleCategories.length === 0) {
        setError(
          'Selected partner is not compatible with your chosen doubles categories. Choose another partner or update categories.',
        );
        return;
      }
    }

    try {
      setSaving(true);

      if (editingPlayerId) {
        const previous = players.find((player) => player.id === editingPlayerId);
        if (!previous) {
          setError('Player record is not available anymore. Please refresh and try again.');
          return;
        }

        await updatePlayer(id, editingPlayerId, {
          name: trimmedName,
          gender,
          department: department.trim() || undefined,
          categories: selectedCategories,
          partnerId: resolvedPartnerId,
          seeded,
        });

        if (previous.partnerId && previous.partnerId !== resolvedPartnerId) {
          await updatePlayer(id, previous.partnerId, { partnerId: null });
        }

        if (resolvedPartnerId) {
          await updatePlayer(id, resolvedPartnerId, { partnerId: editingPlayerId });
        }
      } else {
        const newPlayerId = await addPlayer(id, {
          name: trimmedName,
          gender,
          department: department.trim() || undefined,
          categories: selectedCategories,
          partnerId: resolvedPartnerId,
          seeded,
        });

        if (resolvedPartnerId) {
          await updatePlayer(id, resolvedPartnerId, { partnerId: newPlayerId });
        }
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
      const existingNames = new Set(players.map((player) => normalizeName(player.name)));
      const importWarnings = [...parsed.warnings];
      let added = 0;
      for (const imported of parsed.players) {
        const importedName = normalizeName(imported.name);
        if (existingNames.has(importedName)) {
          importWarnings.push(`Skipped duplicate name: ${imported.name}`);
          continue;
        }

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
        existingNames.add(importedName);

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
        importWarnings.length > 0
          ? ` | Warnings: ${importWarnings.slice(0, 3).join(' ')}`
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

  useEffect(() => {
    if (partnerSelectionEnabled) return;
    if (partnerId !== null) setPartnerId(null);
  }, [partnerId, partnerSelectionEnabled]);

  useEffect(() => {
    if (!editingPlayerId) return;
    const exists = players.some((player) => player.id === editingPlayerId);
    if (!exists) {
      clearForm();
      setError('The player being edited was removed. Form has been reset.');
    }
  }, [editingPlayerId, players]);

  useEffect(() => {
    if (selectedCategories.length === 0) return;
    const allowed = new Set(enabledCategories);
    const next = selectedCategories.filter(
      (category) => allowed.has(category) && isCategoryAllowedForGender(category, gender),
    );
    if (next.length !== selectedCategories.length) {
      setSelectedCategories(next);
    }
  }, [enabledCategories, gender, selectedCategories]);

  useEffect(() => {
    if (partnerId === null) return;
    if (!availablePartnerIds.has(partnerId)) {
      setPartnerId(null);
    }
  }, [availablePartnerIds, partnerId]);

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

        <AppCard>
          <Text style={styles.sectionTitle}>Bulk Import (Excel)</Text>
          <Text style={styles.helpText}>
            Download a template, fill player rows in Excel, then upload. Import auto-detects singles vs doubles format.
          </Text>
          <View style={styles.templateActions}>
            <AppButton
              variant="secondary"
              label="Download Singles Template"
              onPress={() => void handleDownloadTemplate('singles')}
            />
            <AppButton
              variant="secondary"
              label="Download Doubles Template"
              onPress={() => void handleDownloadTemplate('doubles')}
            />
          </View>
          <AppButton
            label={importing ? 'Importing...' : 'Upload Excel File'}
            onPress={() => void handleBulkImport()}
            disabled={importing}
          />
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Register Player</Text>
          <Text style={styles.helpText}>
            Add players one by one or edit existing players. Partner linking is available only when a doubles category is selected.
          </Text>

          <AppInput
            label="Player Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter player name"
          />

          <AppInput
            label="Department (Optional)"
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g. Engineering"
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
                  {toPlayerGenderLabel(value)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Categories</Text>
          <View style={styles.chipsWrap}>
            {enabledCategories.map((category) => {
              const selected = selectedCategories.includes(category);
              const disabled = !isCategoryAllowedForGender(category, gender);
              return (
                <Pressable
                  key={category}
                  style={[
                    styles.chip,
                    selected && styles.chipActive,
                    disabled && styles.chipDisabled,
                  ]}
                  onPress={() => toggleCategory(category)}
                  disabled={disabled}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextActive,
                      disabled && styles.chipTextDisabled,
                    ]}
                  >
                    {toCategoryLabel(category)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Seeded Player</Text>
            <Switch value={seeded} onValueChange={setSeeded} />
          </View>

          <Text style={styles.label}>Doubles Partner (optional)</Text>
          {partnerSelectionEnabled ? (
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
                  <Text style={styles.partnerSubtext}>
                    {toCategoryLabel(
                      getCompatibleDoublesCategories(
                        gender,
                        candidate.gender,
                        selectedCategories,
                        candidate.categories,
                      )[0],
                    )}
                  </Text>
                </Pressable>
              ))}
              {availablePartners.length === 0 ? (
                <Text style={styles.helpText}>No compatible partner is currently available.</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.helpText}>
              Select at least one doubles category to enable partner pairing.
            </Text>
          )}

          <AppButton
            label={saving ? (editingPlayer ? 'Saving...' : 'Adding...') : editingPlayer ? 'Save Player' : 'Add Player'}
            onPress={() => void handleSavePlayer()}
            disabled={saving}
          />

          {editingPlayer ? (
            <AppButton
              variant="secondary"
              label="Cancel Edit"
              onPress={clearForm}
              disabled={saving}
            />
          ) : null}
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Roster Overview</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{players.length}</Text>
              <Text style={styles.metricLabel}>Players</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{seededCount}</Text>
              <Text style={styles.metricLabel}>Seeded</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{Math.floor(pairedCount / 2)}</Text>
              <Text style={styles.metricLabel}>Pairs</Text>
            </View>
          </View>
        </AppCard>

        <AppCard>
          <Text style={styles.sectionTitle}>Registered Players ({filteredPlayers.length})</Text>
          <AppInput
            label="Search Players"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, department, gender, or category"
          />
          <PlayerList
            players={filteredPlayers}
            allPlayers={players}
            onEdit={handleStartEdit}
            onDelete={handleDelete}
          />
        </AppCard>

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
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
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
  helpText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  templateActions: {
    gap: 8,
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
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    color: '#334155',
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#1D4ED8',
  },
  chipTextDisabled: {
    color: '#64748B',
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
  partnerSubtext: {
    marginTop: 3,
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 18,
  },
  metricLabel: {
    color: '#64748B',
    fontWeight: '700',
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
