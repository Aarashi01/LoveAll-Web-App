/**
 * Cryptographically random hex string. Uses the platform's WebCrypto
 * (available in modern React Native + browsers via getRandomValues).
 */
export function generateNonce(byteLength: number = 32): string {
  const bytes = new Uint8Array(byteLength);
  // globalThis.crypto is provided by browsers and React Native (Hermes 0.74+).
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}
