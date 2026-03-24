import { constants, createDecipheriv, createHash, privateDecrypt } from "crypto";

export type EncryptedPayloadEnvelope = {
  iv: string;
  ciphertext: string;
  wrappedKey: string;
  alg?: string;
  keyAlg?: string;
};

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function getAnalyzePrivateKey(): string | null {
  const key =
    process.env.ANALYZE_PAYLOAD_PRIVATE_KEY ||
    process.env.DEEP_SCAN_PRIVATE_KEY ||
    null;
  return key ? normalizePem(key) : null;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

export function decryptTextPayload(
  envelope: EncryptedPayloadEnvelope,
  expectedTextHash?: string
): string {
  const privateKeyPem = getAnalyzePrivateKey();
  if (!privateKeyPem) {
    throw new Error(
      "ANALYZE_PAYLOAD_PRIVATE_KEY (or DEEP_SCAN_PRIVATE_KEY) is not configured"
    );
  }

  const iv = decodeBase64(envelope.iv);
  const ciphertextWithTag = decodeBase64(envelope.ciphertext);
  const wrappedKey = decodeBase64(envelope.wrappedKey);

  if (ciphertextWithTag.length <= 16) {
    throw new Error("Invalid encrypted payload (ciphertext too short)");
  }

  const aesKey = privateDecrypt(
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    wrappedKey
  );

  const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8"
  );

  if (expectedTextHash) {
    const actualHash = sha256Hex(plaintext);
    if (actualHash !== expectedTextHash) {
      throw new Error("Encrypted payload hash mismatch");
    }
  }

  return plaintext;
}
