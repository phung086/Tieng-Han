import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const KEY_LENGTH = 64;
const N = 16_384;
const R = 8;
const P = 1;
const MAX_MEM = 64 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      options,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derive(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });

  return [
    "scrypt",
    String(N),
    String(R),
    String(P),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !nRaw ||
    !rRaw ||
    !pRaw ||
    !saltRaw ||
    !hashRaw
  ) {
    return false;
  }

  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(hashRaw, "base64url");
  const derived = await derive(password, salt, expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    maxmem: MAX_MEM,
  });

  return (
    derived.length === expected.length &&
    timingSafeEqual(derived, expected)
  );
}
