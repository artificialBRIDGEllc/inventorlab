// ═══════════════════════════════════════════════════════════════════════════
// INVENTORLAB — Counsel Review Console
//
// Privileged access tier for patent attorneys.
// Counsel can: view matters, view ledger, annotate claims, flag concerns,
//              mark matter "Ready to File".
// Counsel CANNOT: modify inventor-authored content (conception narrative,
//                 claim attestations), delete ledger entries.
//
// Post-Heppner architecture:
//   All counsel interactions are logged to the Provenance Ledger.
//   Privilege banner is always displayed.
//   Privilege log entries auto-generated for litigation hold.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "./db";
import {
  matters, users, matterInventors, conceptionNarratives,
  claimElements, inventorshipDisputes, priorArtReferences,
  inventionRecords, provenanceLedger,
} from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { writeLedgerEntry } from "./ledger";
import { verifyChainIntegrity } from "./ledger";

// ── Counsel matter view (full read) ──────────────────────────────────────────
export async function getCounselMatterView(matterId: number, counselId: number) {
  const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
  if (!matter) throw new Error("Matter not found");

  // Log counsel access to provenance ledger (privilege log)
  await writeLedgerEntry({
    matterId,
    tenantId:   matter.tenantId,
    eventType:  "matter_created", // using available enum; production: add "counsel_viewed"
    actorId:    counselId,
    actorType:  "human",
    payload: {
      action:    "counsel_matter_view",
      counselId,
      timestamp: new Date().toISOString(),
      privilegeNote: "Attorney-client privileged access. Auto-logged for privilege log.",
    },
  });

  // Build comprehensive matter view
  const inventorLinks = await db.select().from(matterInventors).where(eq(matterInventors.matterId, matterId));
  const inventors = await Promise.all(inventorLinks.map(async (link) => {
    const [u] = await db.select().from(users).where(eq(users.id, link.userId)).limit(1);
    return { ...link, user: u };
  }));

  const conceptions = await db.select().from(conceptionNarratives)
    .where(eq(conceptionNarratives.matterId, matterId));

  const claims = await db.select().from(claimElements)
    .where(eq(claimElements.matterId, matterId))
    .orderBy(claimElements.elementNumber);

  const disputes = await db.select().from(inventorshipDisputes)
    .where(eq(inventorshipDisputes.matterId, matterId))
    .orderBy(desc(inventorshipDisputes.createdAt));

  const priorArt = await db.select().from(priorArtReferences)
    .where(eq(priorArtReferences.matterId, matterId));

  const [inventionRecord] = await db.select().from(inventionRecords)
    .where(eq(inventionRecords.matterId, matterId)).limit(1);

  const ledgerIntegrity = await verifyChainIntegrity(matterId);

  return {
    matter,
    inventors,
    conceptions,
    claims,
    disputes,
    priorArt,
    inventionRecord: inventionRecord ?? null,
    ledgerIntegrity,
    privilegeLog: {
      note: "This matter view is privileged attorney-client communication. All access is logged.",
      counselId,
      accessedAt: new Date().toISOString(),
    },
  };
}

// ── Counsel annotate claim ────────────────────────────────────────────────────
// Counsel can add annotations — logged to provenance ledger.
// Counsel CANNOT modify inventor attestations or accepted text.
export async function counselAnnotateClaim(
  matterId:     number,
  claimId:      number,
  counselId:    number,
  annotation:   string,
  concernLevel: "none" | "minor" | "major" | "blocking"
) {
  const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
  if (!matter) throw new Error("Matter not found");

  await writeLedgerEntry({
    matterId,
    tenantId:  matter.tenantId,
    eventType: "prior_art_annotated", // closest available; production: "counsel_annotation"
    actorId:   counselId,
    actorType: "human",
    payload: {
      action:       "counsel_claim_annotation",
      claimId,
      annotation,
      concernLevel,
      counselId,
      privilegeNote: "Counsel annotation — privileged.",
    },
  });

  return { ok: true, claimId, annotation, concernLevel, annotatedAt: new Date().toISOString() };
}

// ── Counsel mark matter ready to file ────────────────────────────────────────
// ONLY a counsel-tier user can release a matter for filing.
export async function counselMarkReadyToFile(
  matterId:     number,
  counselId:    number,
  signOffNotes: string
): Promise<{ ok: boolean; readyAt: string }> {
  const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
  if (!matter) throw new Error("Matter not found");

  // Check: all conceptions must be locked
  const conceptions = await db.select().from(conceptionNarratives).where(eq(conceptionNarratives.matterId, matterId));
  const allLocked = conceptions.every(c => c.isLocked);
  if (!allLocked) throw new Error("All conception narratives must be locked before counsel can release for filing.");

  // Check: at least one accepted claim
  const claims = await db.select().from(claimElements)
    .where(and(eq(claimElements.matterId, matterId), eq(claimElements.status, "accepted")));
  if (claims.length === 0) throw new Error("At least one accepted claim element is required before filing release.");

  // Check: no open blocking disputes
  const openDisputes = await db.select().from(inventorshipDisputes)
    .where(and(eq(inventorshipDisputes.matterId, matterId), eq(inventorshipDisputes.status, "open")));
  if (openDisputes.length > 0) {
    throw new Error(`Cannot release for filing: ${openDisputes.length} open co-inventorship dispute(s) must be resolved first.`);
  }

  // Update matter status
  await db.update(matters).set({ status: "active" }).where(eq(matters.id, matterId));

  await writeLedgerEntry({
    matterId,
    tenantId:  matter.tenantId,
    eventType: "filing_started",
    actorId:   counselId,
    actorType: "human",
    payload: {
      action:       "counsel_ready_to_file",
      counselId,
      signOffNotes,
      timestamp:    new Date().toISOString(),
      checklist: {
        conceptions_locked: allLocked,
        claims_accepted:    claims.length,
        disputes_resolved:  openDisputes.length === 0,
      },
    },
  });

  return { ok: true, readyAt: new Date().toISOString() };
}

// ── Counsel open dispute (flag from counsel side) ─────────────────────────────
export async function counselFlagConcern(
  matterId:    number,
  counselId:   number,
  concernType: string,
  description: string,
  claimId?:    number
) {
  const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
  if (!matter) throw new Error("Matter not found");

  await writeLedgerEntry({
    matterId,
    tenantId:  matter.tenantId,
    eventType: "counsel_notified",
    actorId:   counselId,
    actorType: "human",
    payload: {
      action:      "counsel_concern_flagged",
      concernType,
      description,
      claimId:     claimId ?? null,
      counselId,
      timestamp:   new Date().toISOString(),
    },
  });

  return { ok: true, flaggedAt: new Date().toISOString() };
}
