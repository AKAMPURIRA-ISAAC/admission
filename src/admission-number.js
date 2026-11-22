import { randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeAdmissionNumber() {
  let suffix = "";
  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[randomInt(alphabet.length)];
  }
  return `HH-${suffix}`;
}
