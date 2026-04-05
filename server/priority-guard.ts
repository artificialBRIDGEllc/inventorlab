// ═══════════════════════════════════════════════════════════════════════════
// PRIORITY GUARD — v10 Feature
//
// Detects when a nonprovisional or continuation adds claim elements that
// were NOT present in the parent provisional's locked conception narrative
// or accepted claim elements. Flags potential priority date gaps.
//
// Rules (per USPTO §119(e) and §120):
//   CONTINUATION  — no new matter allowed. Any claim element not in parent
//                   conception/claims is a § 112 new matter violation risk.
//   CIP           — new matter is intentional. Flag additions as CIP new
//                   matter, require explicit inventor designation.
//   DIVISIONAL    — same matter as parent, different claims. Should have
//                   100% coverage in parent — flag any gaps.
//   NONPROVISIONAL → PROVISIONAL — check provisional conception covers all
//                   nonprovisional claim elements.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "./db";
import {
  matters, claimElements, conceptionNarratives, provenanceLedger,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { writeLedgerEntry } from "./ledger";

export interface PriorityGuardResult {
  matterId:            number;
  parentMatterId:      number | null;
  applicationType:     string;
  isCip:               boolean;
  totalCurrentClaims:  number;
  coveredByParent:     number;
  uncoveredClaims:     PriorityGapItem[];
  cipNewMatterItems:   PriorityGapItem[];
  overallStatus:       "CLEAR" | "GAP_DETECTED" | "CIP_NEW_MATTER" | "NO_PARENT";
  recommendation:      string;
}

export interface PriorityGapItem {
  claimElementId:     number;
  elementNumber:      number;
  claimText:          string;
  gapType:            "PRIORITY_DATE_RISK" | "CIP_NEW_MATTER" | "DIVISIONAL_MISMATCH";
  explanation:        string;
}

// ── Main Priority Guard analysis ──────────────────────────────────────────────
export async function runPriorityGuard(
  matterId: number,
  tenantId: number,
  requestingUserId: number
): Promise<PriorityGuardResult> {

  // 1. Load current matter
  const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
  if (!matter) throw new Error("Matter not found");

  // No parent — guard not applicable
  if (!matter.parentMatterId) {
    return {
      matterId, parentMatterId: null,
      applicationType: matter.applicationType,
      isCip: matter.isCip ?? false,
      totalCurrentClaims: 0, coveredByParent: 0,
      uncoveredClaims: [], cipNewMatterItems: [],
      overallStatus: "NO_PARENT",
      recommendation: "No parent matter linked. Priority Guard only applies to continuation, CIP, divisional, and nonprovisional applications with a parent provisional.",
    };
  }

  // 2. Load parent matter's accepted claims and locked conception
  const parentClaims = await db.select().from(claimElements).where(
    and(eq(claimElements.matterId, matter.parentMatterId), eq(claimElements.status, "accepted"))
  );

  const [parentConception] = await db.select().from(conceptionNarratives).where(
    and(eq(conceptionNarratives.matterId, matter.parentMatterId), eq(conceptionNarratives.isLocked, true))
  ).limit(1);

  const parentConceptionText = parentConception?.narrative ?? "";
  const parentClaimTexts     = parentClaims.map(c => (c.humanFinalText ?? c.aiProposedText ?? "").toLowerCase());

  // 3. Load current matter's accepted claims
  const currentClaims = await db.select().from(claimElements).where(
    and(eq(claimElements.matterId, matterId), eq(claimElements.status, "accepted"))
  );

  if (currentClaims.length === 0) {
    return {
      matterId, parentMatterId: matter.parentMatterId,
      applicationType: matter.applicationType,
      isCip: matter.isCip ?? false,
      totalCurrentClaims: 0, coveredByParent: 0,
      uncoveredClaims: [], cipNewMatterItems: [],
      overallStatus: "CLEAR",
      recommendation: "No accepted claims yet. Run Priority Guard after accepting claim elements.",
    };
  }

  // 4. Analyze coverage
  const uncovered:     PriorityGapItem[] = [];
  const cipNewMatter:  PriorityGapItem[] = [];
  let   coveredCount = 0;

  for (const claim of currentClaims) {
    const claimText = (claim.humanFinalText ?? claim.aiProposedText ?? "").toLowerCase();
    if (!claimText.trim()) continue;

    // Check coverage: does this claim element appear in parent claims or conception?
    const inParentClaims      = parentClaimTexts.some(pc => isCovered(claimText, pc));
    const inParentConception  = isCoveredByNarrative(claimText, parentConceptionText.toLowerCase());
    const covered             = inParentClaims || inParentConception;

    if (covered) {
      coveredCount++;
    } else {
      // Uncovered — classify by application type
      if (matter.isCip) {
        // CIP: new matter is intentional — classify as CIP new matter (valid but requires designation)
        cipNewMatter.push({
          claimElementId: claim.id,
          elementNumber:  claim.elementNumber,
          claimText:      claim.humanFinalText ?? claim.aiProposedText ?? "",
          gapType:        "CIP_NEW_MATTER",
          explanation:    `This claim element introduces new matter not present in the parent application (${matter.parentMatterId}). As a CIP, this is permitted — but this element's priority date will be the CIP filing date, not the parent's filing date. Ensure this is intentional and designate it as CIP new matter in your application.`,
        });
      } else if (matter.applicationType === "continuation" || matter.applicationType === "divisional") {
        // Continuation/divisional: new matter is NOT allowed — this is a §112 risk
        uncovered.push({
          claimElementId: claim.id,
          elementNumber:  claim.elementNumber,
          claimText:      claim.humanFinalText ?? claim.aiProposedText ?? "",
          gapType:        "PRIORITY_DATE_RISK",
          explanation:    `This claim element was not found in the parent application's conception narrative or accepted claims. In a ${matter.applicationType}, all claim elements must be fully supported by the parent disclosure. This may constitute new matter under 35 U.S.C. §112 and could invalidate the priority claim for this element. Counsel review required.`,
        });
      } else if (matter.applicationType === "nonprovisional") {
        // Nonprovisional → parent provisional: elements not in provisional lose the priority date
        uncovered.push({
          claimElementId: claim.id,
          elementNumber:  claim.elementNumber,
          claimText:      claim.humanFinalText ?? claim.aiProposedText ?? "",
          gapType:        "PRIORITY_DATE_RISK",
          explanation:    `This claim element was not found in the parent provisional application. It cannot claim the provisional's priority date under 35 U.S.C. §119(e). If this element is critical, consider whether a new provisional should be filed first, or whether to accept a later priority date for this element.`,
        });
      }
    }

    // Flag the claim element in DB
    if (!covered && !matter.isCip) {
      await db.update(claimElements)
        .set({ isPriorityGuardFlagged: true })
        .where(eq(claimElements.id, claim.id));
    }
  }

  // 5. Determine overall status
  let overallStatus: PriorityGuardResult["overallStatus"] = "CLEAR";
  let recommendation = "";

  if (uncovered.length > 0) {
    overallStatus = "GAP_DETECTED";
    recommendation = `Priority Guard detected ${uncovered.length} claim element(s) with potential priority date gaps. These elements may not be entitled to the parent application's filing date. Counsel review is required before filing. Consider: (1) amending parent disclosure to support these elements, (2) filing a new provisional, or (3) accepting a later priority date for affected claims.`;
  } else if (cipNewMatter.length > 0) {
    overallStatus = "CIP_NEW_MATTER";
    recommendation = `CIP confirmed: ${cipNewMatter.length} claim element(s) introduce new matter intentionally. These elements will carry the CIP's filing date as their priority date, not the parent's. Ensure each is properly designated as new matter in the CIP application and that inventor attestations are updated accordingly.`;
  } else {
    recommendation = `All ${currentClaims.length} accepted claim elements are supported by the parent application's disclosure. Priority claim appears intact. This analysis is informational — counsel should independently verify before filing.`;
  }

  // 6. Write to Provenance Ledger
  await writeLedgerEntry({
    matterId, tenantId,
    eventType:  "matter_created", // closest available; in production add "priority_guard_run"
    actorId:    requestingUserId,
    actorType:  "system",
    payload: {
      action:           "priority_guard_analysis",
      parentMatterId:   matter.parentMatterId,
      applicationType:  matter.applicationType,
      isCip:            matter.isCip,
      totalClaims:      currentClaims.length,
      coveredCount,
      gapCount:         uncovered.length,
      cipNewMatterCount: cipNewMatter.length,
      overallStatus,
    },
  });

  return {
    matterId,
    parentMatterId:    matter.parentMatterId,
    applicationType:   matter.applicationType,
    isCip:             matter.isCip ?? false,
    totalCurrentClaims: currentClaims.length,
    coveredByParent:   coveredCount,
    uncoveredClaims:   uncovered,
    cipNewMatterItems: cipNewMatter,
    overallStatus,
    recommendation,
  };
}

// ── Coverage heuristics ───────────────────────────────────────────────────────
// Check if a claim text is substantively covered by a parent claim
function isCovered(childText: string, parentText: string): boolean {
  if (!childText || !parentText) return false;
  // Extract key noun phrases (3+ char words, not stopwords)
  const stopwords = new Set(["the","a","an","of","in","to","for","and","or","is","are","that","with","which","wherein"]);
  const keywords  = childText.split(/\W+/).filter(w => w.length >= 4 && !stopwords.has(w));
  if (keywords.length === 0) return false;
  // Child is "covered" if >= 60% of its keywords appear in parent
  const matchCount = keywords.filter(k => parentText.includes(k)).length;
  return matchCount / keywords.length >= 0.60;
}

// Check if a claim text is covered by the parent's conception narrative
function isCoveredByNarrative(claimText: string, narrativeText: string): boolean {
  if (!claimText || !narrativeText) return false;
  const stopwords = new Set(["the","a","an","of","in","to","for","and","or","is","are","that","with","which","wherein"]);
  const keywords  = claimText.split(/\W+/).filter(w => w.length >= 4 && !stopwords.has(w));
  if (keywords.length === 0) return false;
  // More lenient for narrative coverage: 40% match threshold
  const matchCount = keywords.filter(k => narrativeText.includes(k)).length;
  return matchCount / keywords.length >= 0.40;
}
