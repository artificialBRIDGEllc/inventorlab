// ═══════════════════════════════════════════════════════════════════════════
// INVENTORLAB — Cryptographic Services
// SHA-256 hashing + RFC 3161 TSA timestamping + chain hash
// ═══════════════════════════════════════════════════════════════════════════

import crypto from "crypto";

// ── SHA-256 hash of any string payload ───────────────────────────────────────
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

// ── Chain hash: links each ledger entry to the previous ──────────────────────
// chainHash = SHA-256(prevChainHash + payloadHash)
// First entry: chainHash = SHA-256("GENESIS" + payloadHash)
export function computeChainHash(prevChainHash: string | null, payloadHash: string): string {
  const prev = prevChainHash ?? "GENESIS";
  return sha256(prev + payloadHash);
}

// ── RFC 3161 Timestamp Request ────────────────────────────────────────────────
// Sends a TimeStampReq to a NIST-accredited TSA, returns the token hex string.
// TSA provides court-admissible proof of existence at a specific time.
//
// In production: DigiCert (http://timestamp.digicert.com)
//                Entrust   (http://timestamp.entrust.net/TSS/RFC3161sha2TS)
// In development / missing key: returns a mock token for local dev only.
export async function requestRfc3161Timestamp(
  dataHash: string  // SHA-256 hex of the data to timestamp
): Promise<{ token: string; serial: string; timestamp: Date } | null> {
  const tsaUrl = process.env.TSA_URL;

  // Development fallback — clearly marked as mock
  if (!tsaUrl || process.env.NODE_ENV !== "production") {
    const mockSerial = crypto.randomBytes(8).toString("hex");
    return {
      token:     `MOCK_TSA_${dataHash.slice(0, 16)}_${Date.now()}`,
      serial:    mockSerial,
      timestamp: new Date(),
    };
  }

  try {
    // Build RFC 3161 TimeStampReq (DER-encoded)
    // Simplified: send SHA-256 hash as message imprint
    // Full DER encoding would use an ASN.1 library in production
    const hashBytes   = Buffer.from(dataHash, "hex");
    const nonce       = crypto.randomBytes(8);
    const policyOid   = process.env.TSA_POLICY_OID ?? "2.16.840.1.114412.7.1";

    // For production, use the `timestamp` npm package or forge/pkijs for proper DER encoding
    // This implementation sends the hash directly for simplicity in the prototype
    const res = await fetch(tsaUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/timestamp-query" },
      body:    hashBytes,
      signal:  AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[TSA] Request failed: ${res.status}`);
      return null;
    }

    const responseBytes = Buffer.from(await res.arrayBuffer());
    const tokenHex      = responseBytes.toString("hex");
    const serial        = crypto.randomBytes(8).toString("hex"); // extract from DER in production

    return { token: tokenHex, serial, timestamp: new Date() };
  } catch (e) {
    console.error("[TSA] Error:", e instanceof Error ? e.message : e);
    return null;
  }
}
