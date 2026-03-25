// PIN hashing utilities using Web Crypto API (SHA-256)

const SALT = "schoolapp_v1_salt_2024";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  // Support legacy plain-text PINs during migration
  if (hash.length <= 8 && /^\d+$/.test(hash)) {
    return pin === hash;
  }
  const pinHash = await hashPin(pin);
  return pinHash === hash;
}
