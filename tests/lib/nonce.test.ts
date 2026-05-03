import { generateNonce } from '@/lib/nonce';

describe('generateNonce', () => {
  it('returns a 64-character lowercase hex string by default', () => {
    const n = generateNonce();
    expect(n).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique values across many calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) set.add(generateNonce());
    expect(set.size).toBe(10_000);
  });

  it('respects the byte-length argument', () => {
    expect(generateNonce(16)).toMatch(/^[0-9a-f]{32}$/);
  });
});
