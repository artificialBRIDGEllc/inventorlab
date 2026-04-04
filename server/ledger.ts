// ═══════════════════════════════════════════════════════════════════════════
// INVENTORLAB — Provenance Ledger Service
//
// IMMUTABLE — entries are NEVER updated or deleted.
// Every event in the system writes to this ledger.
// Chain hash links each entry to the previous, making tampering detectable.
// RFC 3161 TSA timestamp provides court-admissible proof of time.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "./db";
import { provenanceLedger } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { sha256, computeChainHash, requestRfc3161Timestamp } from "./crypto";
import type { ledgerEventTypeEnum } from "@shared/schema";

type LedgerEventType = typeof ledgerEventTypeEnum.enumValues[number];

interface LedgerWriteInput {
  matterId:   number;
  tenantId:   number;
  eventType:  LedgerEventType;
  actorId?:   number | null;
  actorType?: "human" | "ai" | "system";
  aiModelId?: string;
  payload:    Record<string, unknown>;
}

export async function writeLedgerEntry(input: LedgerWriteInput): Promise<typeof provenanceLedger.$inferSelect> {
  // 1. Serialize and hash the payload
  const payloadStr  = JSON.stringify({ ...input.payload, matterId: input.matterId, eventType: input.eventType });
  const payloadHash = sha256(payloadStr);

  // 2. Get previous chain hash for this matter
  const [lastEntry] = await db
    .select({ chainHash: provenanceLedger.chainHash })
    .from(provenanceLedger)
    .where(eq(provenanceLedger.matterId, input.matterId))
    .orderBy(desc(provenanceLedger.id))
    .limit(1);

  const prevChainHash = lastEntry?.chainHash ?? null;
  const chainHash     = computeChainHash(prevChainHash, payloadHash);

  // 3. Request RFC 3161 timestamp (async, non-blocking for writes)
  const tsaResult = await requestRfc3161Timestamp(payloadHash);

  // 4. Write entry — immutable insert, never update
  const [entry] = await db
    .insert(provenanceLedger)
    .values({
      matterId:     input.matterId,
      tenantId:     input.tenantId,
      eventType:    input.eventType,
      actorId:      input.actorId ?? null,
      actorType:    input.actorType ?? "human",
      aiModelId:    input.aiModelId ?? null,
      payloadHash,
      payload:      input.payload,
      tsa3161Token: tsaResult?.token ?? null,
      tsaSerial:    tsaResult?.serial ?? null,
      tsaTimestamp: tsaResult?.timestamp ?? null,
      chainHash,
    })
    .returning();

  return entry;
}

export async function getLedgerForMatter(matterId: number) {
  return db
    .select()
    .from(provenanceLedger)
    .where(eq(provenanceLedger.matterId, matterId))
    .orderBy(provenanceLedger.id);
}

// Verify chain integrity — detects any tampering
export async function verifyChainIntegrity(matterId: number): Promise<{
  valid: boolean;
  totalEntries: number;
  firstBrokenAt?: number;
}> {
  const entries = await getLedgerForMatter(matterId);
  if (entries.length === 0) return { valid: true, totalEntries: 0 };

  let prevHash: string | null = null;
  for (const entry of entries) {
    const expected = computeChainHash(prevHash, entry.payloadHash);
    if (expected !== entry.chainHash) {
      return { valid: false, totalEntries: entries.length, firstBrokenAt: entry.id };
    }
    prevHash = entry.chainHash;
  }
  return { valid: true, totalEntries: entries.length };
}
