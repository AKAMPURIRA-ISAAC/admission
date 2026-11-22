import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, keyLength);
  return {
    passwordSalt: salt.toString("hex"),
    passwordHash: derivedKey.toString("hex"),
  };
}

export async function verifyPassword(password, passwordSalt, passwordHash) {
  const salt = Buffer.from(passwordSalt, "hex");
  const expected = Buffer.from(passwordHash, "hex");
  if (salt.length !== 16 || expected.length !== keyLength) {
    return false;
  }
  const actual = await scrypt(password, salt, keyLength);
  return timingSafeEqual(actual, expected);
}
