/**
 * AES-GCM encryption helpers for integration OAuth tokens.
 * Key comes from INTEGRATION_TOKEN_KEY (base64-encoded 256-bit / 32-byte key).
 * Falls back to identity (plain store) when the key is not set so that local
 * dev without the variable still works.
 */

const KEY_ENV = "INTEGRATION_TOKEN_KEY";

let _key: CryptoKey | null = null;
let _keyWarned = false;

async function getKey(): Promise<CryptoKey | null> {
  if (_key) return _key;

  const raw = process.env[KEY_ENV];
  if (!raw) {
    if (!_keyWarned) {
      console.warn(
        `[crypto] ${KEY_ENV} is not set — integration tokens will be stored in plaintext. ` +
          "Set this to a base64-encoded 32-byte key in production."
      );
      _keyWarned = true;
    }
    return null;
  }

  const keyBytes = Buffer.from(raw, "base64");
  if (keyBytes.length !== 32) {
    console.warn(
      `[crypto] ${KEY_ENV} must be a base64-encoded 32-byte key (got ${keyBytes.length} bytes). ` +
        "Falling back to plaintext storage."
    );
    return null;
  }

  _key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return _key;
}

/**
 * Encrypts a plaintext string with AES-GCM.
 * Returns a base64-encoded string in the format `<iv_hex>:<ciphertext_base64>`.
 * Falls back to identity if INTEGRATION_TOKEN_KEY is not set.
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  if (!key) return plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const ivHex = Buffer.from(iv).toString("hex");
  const ctBase64 = Buffer.from(ciphertext).toString("base64");
  return `${ivHex}:${ctBase64}`;
}

/**
 * Decrypts a ciphertext string previously produced by `encryptToken`.
 * Falls back to identity if the value doesn't look encrypted or INTEGRATION_TOKEN_KEY is not set.
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  const key = await getKey();
  if (!key) return ciphertext;

  // If the stored value doesn't contain the separator it was stored in plaintext
  // (e.g. migrated from a pre-encryption deployment).
  if (!ciphertext.includes(":")) return ciphertext;

  const [ivHex, ctBase64] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const ct = Buffer.from(ctBase64, "base64");

  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(decrypted);
  } catch {
    // Decryption failed — token may have been stored before encryption was enabled.
    console.warn("[crypto] Failed to decrypt token — returning raw value.");
    return ciphertext;
  }
}
