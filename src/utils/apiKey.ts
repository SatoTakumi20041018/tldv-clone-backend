import { randomBytes } from "crypto";

export function generateApiKey(): string {
  const prefix = "tldv";
  const key = randomBytes(32).toString("hex");
  return `${prefix}_${key}`;
}
