import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Link, useLocalSearchParams } from 'expo-router';
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
  useWindowDimensions,
} from 'react-native';

import { PlayerList } from '@/components/tournament/PlayerList';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { theme, toCategoryLabel, toPlayerGenderLabel } from '@/constants/theme';
import { useTournament } from '@/hooks/useTournament';
import { addPlayer, deletePlayer, subscribeToPlayers, updatePlayer } from '@/lib/firestore/players';
import { type MatchCategory, type PlayerDocument, type PlayerGender } from '@/lib/firestore/types';
import {
  downloadTemplateExcel,
  parsePlayersWorkbookFromArrayBuffer,
  parsePlayersWorkbookFromBase64,
} from '@/lib/player-excel';

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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; categories?: string }>({});

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

  const { width } = useWindowDimensions();
  const isWide = width >= 1024;

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
    setFieldErrors({});
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
    setFieldErrors({});
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
    const nextFieldErrors: { name?: string; categories?: string } = {};

    if (!trimmedName) {
      nextFieldErrors.name = 'Player name is required.';
    }

    if (selectedCategories.length === 0) {
      nextFieldErrors.categories = 'Select at least one category.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});

    const normalized = normalizeName(trimmedName);
    const duplicate = players.find(
      (player) => normalizeName(player.name) === normalized && player.id !== editingPlayerId,
    );
    if (duplicate) {
      setFieldErrors({ name: `"${trimmedName}" already exists in the player list.` });
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

        const playerData = {
          name: trimmedName,
          gender,
          categories: selectedCategories,
          partnerId: resolvedPartnerId,
          seeded,
          ...(department.trim() ? { department: department.trim() } : {}),
        };

        await updatePlayer(id, editingPlayerId, playerData);

        if (previous.partnerId && previous.partnerId !== resolvedPartnerId) {
          await updatePlayer(id, previous.partnerId, { partnerId: null });
        }

        if (resolvedPartnerId) {
          await updatePlayer(id, resolvedPartnerId, { partnerId: editingPlayerId });
        }
      } else {
        const playerData = {
          name: trimmedName,
          gender,
          categories: selectedCategories,
          partnerId: resolvedPartnerId,
          seeded,
          ...(department.trim() ? { department: department.trim() } : {}),
        };

        const newPlayerId = await addPlayer(id, playerData);

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

    const message = `Remove ${player.name} from this tournament?`;

    const doDelete = async () => {
      try {
        if (player.partnerId) {
          await updatePlayer(id, player.partnerId, { partnerId: null });
        }
        await deletePlayer(id, player.id);
      } catch (value) {
        const errorMessage = value instanceof Error ? value.message : 'Delete failed';
        setError(errorMessage);
      }
    };

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) {
        void doDelete();
      }
      return;
    }

    Alert.alert('Delete player?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
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
        <ActivityIndicator size="large" color="#3B82F6" />
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
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.glowOrb, styles.glowOrbTop]} />
        <View style={[styles.glowOrb, styles.glowOrbBottom]} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Player Setup</Text>
          <Text style={styles.meta}>{tournament.name}</Text>
        </View>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        {importSummary ? <Text style={styles.successBanner}>{importSummary}</Text> : null}

        <View style={{ marginBottom: 24 }}>
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
        </View>

        <View style={isWide ? styles.splitLayout : styles.mobileLayout}>
          <View style={[styles.leftColumn, isWide && { flex: 1, zIndex: 10 }]}>
            <AppCard>
              <Text style={styles.sectionTitle}>Register Player</Text>
              <Text style={styles.helpText}>
                Add players one by one or edit existing players. Partner linking is available only when a doubles category is selected.
              </Text>

              <AppInput
                label="Player Name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter player name"
                errorText={fieldErrors.name}
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

              <Text style={[styles.label, fieldErrors.categories ? styles.labelError : undefined]}>Categories</Text>
              <View style={[styles.chipsWrap, fieldErrors.categories ? styles.chipsWrapError : undefined]}>
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
                      onPress={() => {
                        toggleCategory(category);
                        if (fieldErrors.categories) setFieldErrors((prev) => ({ ...prev, categories: undefined }));
                      }}
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
              {fieldErrors.categories ? <Text style={styles.fieldErrorText}>{fieldErrors.categories}</Text> : null}

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

              <View style={styles.actionRow}>
                <AppButton
                  label={saving ? (editingPlayer ? 'Saving...' : 'Adding...') : editingPlayer ? 'Save Player' : 'Add Player'}
                  onPress={() => void handleSavePlayer()}
                  disabled={saving}
                  style={styles.flex1}
                />

                {editingPlayer ? (
                  <AppButton
                    variant="secondary"
                    label="Cancel"
                    onPress={clearForm}
                    disabled={saving}
                    style={styles.cancelButton}
                  />
                ) : null}
              </View>
            </AppCard>

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
          </View>

          <View style={[styles.rightColumn, isWide && { flex: 1, zIndex: 1 }]}>

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
          </View>
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
    backgroundColor: theme.colors.background,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: theme.radius.full,
    opacity: 0.15,
    ...(typeof window !== 'undefined' && {
      filter: 'blur(100px)',
    }),
  },
  glowOrbTop: {
    width: 600,
    height: 600,
    top: -200,
    right: -200,
    backgroundColor: '#3B82F6', // Deep vibrant blue
  },
  glowOrbBottom: {
    width: 500,
    height: 500,
    bottom: -150,
    left: -150,
    backgroundColor: '#10B981', // Neon emerald
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  header: {
    gap: 4,
  },
  splitLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  mobileLayout: {
    flexDirection: 'column',
    gap: 24,
  },
  leftColumn: {
    gap: 24,
  },
  rightColumn: {
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  meta: {
    marginTop: -8,
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontWeight: '700',
  },
  errorBanner: {
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontWeight: '700',
  },
  successBanner: {
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontWeight: '700',
  },
  helpText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
  },
  templateActions: {
    gap: 8,
  },
  sectionTitle: {
    color: '#F1F5F9',
    fontWeight: '900',
    fontSize: 16,
  },
  label: {
    color: '#CBD5E1',
    fontWeight: '800',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  segment: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1,
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
    }),
  },
  segmentText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#60A5FA',
    fontWeight: '800',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  chipActive: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  chipDisabled: {
    opacity: 0.3,
  },
  chipText: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#60A5FA',
    fontWeight: '800',
  },
  chipTextDisabled: {
    color: '#475569',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  partnerWrap: {
    gap: 8,
  },
  partnerOption: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  partnerOptionActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  partnerText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 15,
  },
  partnerTextActive: {
    color: '#10B981',
  },
  partnerSubtext: {
    marginTop: 4,
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...(typeof window !== 'undefined' && {
      backdropFilter: 'blur(12px)',
    }),
  },
  metricValue: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 24,
  },
  metricLabel: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  nextLink: {
    color: '#FFFFFF',
    backgroundColor: theme.colors.focus,
    borderRadius: 12,
    textAlign: 'center',
    paddingVertical: 16,
    fontWeight: '900',
    fontSize: 16,
    overflow: 'hidden',
    ...(typeof window !== 'undefined' && {
      boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
    }),
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  flex1: {
    flex: 1,
  },
  cancelButton: {
    minWidth: 100,
  },
  labelError: {
    color: '#EF4444',
  },
  chipsWrapError: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 12,
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  fieldErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
});
