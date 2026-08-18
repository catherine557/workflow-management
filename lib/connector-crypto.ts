import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const encoded = process.env.CONNECTOR_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("CONNECTOR_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("CONNECTOR_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

export function encryptConnectorSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptConnectorSecret(value: string) {
  const [version, ivPart, tagPart, ciphertextPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) throw new Error("Stored connector secret is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
