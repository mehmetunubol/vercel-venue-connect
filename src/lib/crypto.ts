/**
 * End-to-end encryption for chats.
 *
 * Each person has an ECDH P-256 key pair generated in their browser. The private key is
 * non-extractable and stays in IndexedDB on that device; only the public key is uploaded.
 * Two matched people derive the same AES-256-GCM key (ECDH + HKDF, salted with the match id),
 * so the server only ever stores ciphertext.
 *
 * Limitation (MVP): keys live on one device. Signing in on a new device creates a new key,
 * and messages sent to the old key can't be read there.
 */

const DB_NAME = "venue-connect-keys";
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type StoredKeys = { privateKey: CryptoKey; publicJwk: JsonWebKey };

/** Returns this device's key pair for the user, creating one if needed. `created` is true if new. */
export async function getOrCreateKeys(userId: string): Promise<StoredKeys & { created: boolean }> {
  const existing = await idbGet<StoredKeys>(`kp:${userId}`);
  if (existing) return { ...existing, created: false };

  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const stored: StoredKeys = { privateKey: pair.privateKey, publicJwk };
  await idbSet(`kp:${userId}`, stored);
  return { ...stored, created: true };
}

export function samePublicKey(a?: JsonWebKey | null, b?: JsonWebKey | null) {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function deriveChatKey(privateKey: CryptoKey, theirPublicJwk: JsonWebKey, matchId: string) {
  const theirKey = await crypto.subtle.importKey("jwk", theirPublicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: theirKey }, privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(matchId), info: enc.encode("venue-connect-chat-v1") },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toB64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function encryptJson(key: CryptoKey, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { ciphertext: toB64(ct), iv: toB64(iv) };
}

export async function decryptJson<T>(key: CryptoKey, ciphertext: string, iv: string): Promise<T | null> {
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ciphertext));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}
