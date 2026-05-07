import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { theme } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteTournament,
  getTournamentPrivateSettings,
  subscribeToTournamentById,
} from "@/lib/firestore/tournaments";
import { type TournamentDocument } from "@/lib/firestore/types";

export default function TournamentManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<TournamentDocument | null>(null);
  const [venuePin, setVenuePin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [showRevealPin, setShowRevealPin] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToTournamentById(id, async (doc) => {
      setTournament(doc);
      if (doc && user && doc.organizerId === user.uid) {
        const privateSettings = await getTournamentPrivateSettings(id);
        setVenuePin(privateSettings?.venuePin ?? null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [id, user]);

  const isDraft = tournament?.status === "draft";
  const isCompleted = tournament?.status === "completed";
  const isActive = !isDraft && !isCompleted;
  const isCreator = user && tournament && user.uid === tournament.organizerId;
  const needsPin = isActive && !authenticated;

  const handlePinSubmit = () => {
    if (!venuePin) return;
    if (pinInput === venuePin) {
      setAuthenticated(true);
      setPinError(null);
    } else {
      setPinError("Incorrect PIN. Please try again.");
    }
  };

  const handleDelete = () => {
    if (!tournament || !isDraft) return;
    const message = `Delete "${tournament.name}"? This cannot be undone.`;
    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm(message);
      if (confirmed) void runDelete();
      return;
    }
    Alert.alert("Delete Tournament?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void runDelete() },
    ]);
  };

  const runDelete = async () => {
    if (!tournament) return;
    try {
      setDeleteError(null);
      setDeleting(true);
      await deleteTournament(tournament.id);
      router.replace("/(organizer)/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  if (!id) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Missing tournament id.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Tournament not found.</Text>
        <AppButton label="Back to dashboard" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  // ─── PIN Gate ──────────────────────────────────────────────────────
  if (needsPin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pinScreen}>
          <View style={styles.pinCard}>
            <Text style={styles.pinEyebrow}>Protected · Active tournament</Text>
            <Text style={styles.pinTitle}>Enter venue PIN.</Text>
            <Text style={styles.pinSubtitle} numberOfLines={2}>
              "{tournament.name}" is currently live. A 4-digit PIN is required to manage it.
            </Text>

            {pinError ? <Text style={styles.pinErrorText}>{pinError}</Text> : null}

            <View style={styles.pinInputRow}>
              <TextInput
                style={styles.pinInput}
                placeholder="• • • •"
                placeholderTextColor={theme.colors.textSubtle}
                value={pinInput}
                onChangeText={(text) => {
                  setPinInput(text.replace(/\D/g, "").slice(0, 4));
                  if (pinError) setPinError(null);
                }}
                onSubmitEditing={handlePinSubmit}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
              />
            </View>

            <AppButton label="Unlock" onPress={handlePinSubmit} />

            {isCreator && (
              <View style={styles.revealSection}>
                {showRevealPin ? (
                  <View style={styles.revealPinBox}>
                    <Text style={styles.revealLabel}>Your venue PIN</Text>
                    <Text style={styles.revealPinValue}>{venuePin}</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => setShowRevealPin(true)}>
                    <Text style={styles.forgotPinLink}>Forgot PIN? (Creator only)</Text>
                  </Pressable>
                )}
              </View>
            )}

            <Pressable onPress={() => router.back()} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Back to dashboard</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main Manage ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero band */}
        <View style={styles.hero}>
          <View style={styles.crumbRow}>
            <Pressable onPress={() => router.back()} style={styles.backArrow} hitSlop={8}>
              <Text style={styles.backArrowText}>←</Text>
            </Pressable>
            <Text style={styles.crumb}>Dashboard / Manage</Text>
          </View>
          <Text style={styles.heroEyebrow}>{isCompleted ? 'Read only' : 'Operations'}</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{tournament.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipLabel}>ID</Text>
              <Text style={styles.metaChipValue}>{id}</Text>
            </View>
            {isCompleted ? (
              <View style={[styles.metaChip, styles.metaChipMuted]}>
                <Text style={styles.metaChipLabelInverse}>READ ONLY</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Operations grid */}
        <View style={styles.contentInner}>
          <Text style={styles.sectionTitle}>Operations overview</Text>
          <View style={styles.grid}>
            <ActionTile
              step="01"
              title="Players"
              desc="Add teams, review signups, set seeds."
              cta="Manage players"
              onPress={() => router.push({ pathname: "/(organizer)/[id]/setup", params: { id } })}
              disabled={!!isCompleted}
            />
            <ActionTile
              step="02"
              title="Schedule"
              desc="Review draws and generated courts."
              cta="Match schedule"
              onPress={() => router.push({ pathname: "/(organizer)/[id]/schedule", params: { id } })}
              disabled={!!isCompleted}
            />
            <ActionTile
              step="03"
              title="Results"
              desc="Log scores and finalize matches."
              cta="Live results & export"
              onPress={() => router.push({ pathname: "/(organizer)/[id]/results", params: { id } })}
              primary
            />
          </View>

          {/* Danger Zone */}
          {isDraft && (
            <View style={styles.dangerBlock}>
              <Text style={styles.dangerLabel}>Danger zone</Text>
              <Text style={styles.dangerDesc}>
                Delete this draft tournament permanently. This action cannot be undone.
              </Text>
              {deleteError ? <Text style={styles.deleteErrorText}>{deleteError}</Text> : null}
              <AppButton
                variant="danger"
                label={deleting ? "Deleting…" : "Delete tournament"}
                disabled={deleting}
                onPress={handleDelete}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({
  step,
  title,
  desc,
  cta,
  onPress,
  disabled,
  primary,
}: {
  step: string;
  title: string;
  desc: string;
  cta: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <View style={[styles.tile, primary && styles.tileInverse]}>
      <Text style={[styles.tileStep, primary && styles.tileStepInverse]}>{step}</Text>
      <Text style={[styles.tileTitle, primary && styles.tileTitleInverse]}>{title}</Text>
      <Text style={[styles.tileDesc, primary && styles.tileDescInverse]}>{desc}</Text>
      <View style={styles.tileSpacer} />
      <AppButton
        label={cta}
        variant={primary ? 'secondary' : 'primary'}
        disabled={disabled}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontWeight: "800",
    fontSize: 15,
  },
  scroll: {
    paddingBottom: 64,
  },

  // PIN gate
  pinScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  pinCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    padding: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  pinEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  pinTitle: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 36,
  },
  pinSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  pinErrorText: {
    color: theme.colors.danger,
    fontWeight: "700",
    fontSize: 13,
  },
  pinInputRow: {
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  pinInput: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "900",
    paddingHorizontal: 18,
    paddingVertical: 14,
    textAlign: "center",
    letterSpacing: 16,
    ...(typeof window !== 'undefined' && ({ outlineStyle: 'none' } as any)),
  },
  revealSection: {
    marginTop: 4,
    alignItems: "center",
  },
  forgotPinLink: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 13,
    textDecorationLine: 'underline',
    ...(typeof window !== "undefined" && ({ cursor: "pointer" } as any)),
  },
  revealPinBox: {
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  revealLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  revealPinValue: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  backLink: {
    marginTop: 4,
    alignSelf: 'center',
    ...(typeof window !== "undefined" && ({ cursor: "pointer" } as any)),
  },
  backLinkText: {
    color: theme.colors.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },

  // Hero
  hero: {
    backgroundColor: theme.colors.surfaceInverse,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  crumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backArrow: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: "center",
    justifyContent: "center",
    ...(typeof window !== "undefined" && ({ cursor: "pointer" } as any)),
  },
  backArrowText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: "800",
  },
  crumb: {
    color: theme.colors.textInverse,
    opacity: 0.6,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.textInverse,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  metaChipMuted: {
    backgroundColor: theme.colors.warning,
    borderColor: theme.colors.warning,
  },
  metaChipLabel: {
    color: theme.colors.textInverse,
    opacity: 0.6,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  metaChipLabelInverse: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  metaChipValue: {
    color: theme.colors.textInverse,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // Body
  contentInner: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.xl,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  tile: {
    flex: 1,
    minWidth: 240,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    gap: 8,
  },
  tileInverse: {
    backgroundColor: theme.colors.surfaceInverse,
    borderColor: theme.colors.surfaceInverse,
  },
  tileStep: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  tileStepInverse: {
    color: theme.colors.textInverse,
    opacity: 0.6,
  },
  tileTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  tileTitleInverse: {
    color: theme.colors.textInverse,
  },
  tileDesc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  tileDescInverse: {
    color: theme.colors.textInverse,
    opacity: 0.7,
  },
  tileSpacer: {
    flex: 1,
    minHeight: 8,
  },

  // Danger
  dangerBlock: {
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dangerSoft,
  },
  dangerLabel: {
    color: theme.colors.danger,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontSize: 12,
  },
  dangerDesc: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  deleteErrorText: {
    color: theme.colors.danger,
    fontWeight: "700",
    fontSize: 13,
  },
});
