import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { computeBannerState } from '@/lib/banner-state';

interface Props {
  expiresAtMs: number;
}

const COLORS: Record<ReturnType<typeof computeBannerState>, { bg: string; fg: string }> = {
  ok:       { bg: '#1E293B', fg: '#94A3B8' },
  warning:  { bg: '#78350F', fg: '#FCD34D' },
  critical: { bg: '#7F1D1D', fg: '#FECACA' },
  expired:  { bg: '#7F1D1D', fg: '#FECACA' },
};

function formatHM(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m >= 5) return `${m} min`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function endTimeText(expiresAtMs: number): string {
  const d = new Date(expiresAtMs);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function SessionBanner({ expiresAtMs }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const remaining = expiresAtMs - now;
  const state = computeBannerState(remaining);
  if (state === 'expired') return null;

  const colors = COLORS[state];
  let label: string;
  if (state === 'ok') {
    label = `Session expires at ${endTimeText(expiresAtMs)}`;
  } else if (state === 'warning') {
    label = `Session expires in ${formatHM(remaining)} — finish current match soon`;
  } else {
    label = `Session expires in ${formatHM(remaining)}. Ask the organizer to scan your QR again to extend.`;
  }

  return (
    <View style={[styles.banner, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 16 },
  text: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
});
