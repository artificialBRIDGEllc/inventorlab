// ═══════════════════════════════════════════════════════════════════════════
// INVENTORLAB — AI Service
// All Claude API calls go through this layer.
// Logs every call to the Provenance Ledger (actor_type = "ai").
// Federally-funded matters: AI claim drafting disabled.
// ═══════════════════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";
import { writeLedgerEntry } from "./ledger";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = "claude-sonnet-4-20250514";

const SYSTEM_ARMOR = `You are InventorLab's claim drafting assistant, operating inside a privileged,
attorney-client protected environment governed by an enterprise DPA with Anthropic.
CRITICAL RULES:
1. You assist human inventors in expressing their own ideas as patent claims — you do NOT conceive inventions.
2. Every claim element you propose must be framed as language to express what the inventor has already told you they conceived.
3. Never suggest that the inventor adopt language they haven't confirmed aligns with their own conception.
4. You are a drafting tool, not a conceiver. Maintain this distinction explicitly.
5. Output valid patent claim language only — no legal advice, no freedom-to-operate opinions.
6. Mark all outputs: "DRAFT — For Counsel Review Only. Not a legal opinion."`;

interface DraftClaimInput {
  matterId:          number;
  tenantId:          number;
  actorId:           number;
  conceptionNarrative: string;
  problemStatement:  string;
  existingElements?: string[];
  instruction?:      string;
}

export async function draftClaimElement(input: DraftClaimInput): Promise<string> {
  const prompt = `The inventor has described their conception as follows:

CONCEPTION NARRATIVE:
${input.conceptionNarrative}

PROBLEM BEING SOLVED:
${input.problemStatement}

${input.existingElements?.length ? `EXISTING CLAIM ELEMENTS ALREADY ACCEPTED:
${input.existingElements.map((e, i) => `${i + 1}. ${e}`).join("\n")}` : ""}

${input.instruction ? `SPECIFIC INSTRUCTION: ${input.instruction}` : "Draft the next independent claim element."}

Draft claim language that expresses what the inventor has described. Use standard patent claim formatting.
The inventor will review, modify if needed, and explicitly attest that this language reflects their own conception.`;

  const message = await client.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    system:     SYSTEM_ARMOR,
    messages:   [{ role: "user", content: prompt }],
  });

  const result = message.content[0].type === "text" ? message.content[0].text : "";

  // Log AI call to Provenance Ledger
  await writeLedgerEntry({
    matterId:  input.matterId,
    tenantId:  input.tenantId,
    eventType: "claim_proposed",
    actorId:   null,
    actorType: "ai",
    aiModelId: MODEL,
    payload: {
      action:           "draft_claim_element",
      promptLength:     prompt.length,
      responseLength:   result.length,
      inputTokens:      message.usage.input_tokens,
      outputTokens:     message.usage.output_tokens,
      invokingUserId:   input.actorId,
    },
  });

  return result;
}

interface PriorArtSearchInput {
  matterId:  number;
  tenantId:  number;
  actorId:   number;
  claimText: string;
  industry?: string;
}

export async function analyzePriorArtRelevance(
  input: PriorArtSearchInput,
  references: { title: string; abstract: string; patentNumber?: string }[]
): Promise<{ patentNumber?: string; title: string; relevanceScore: number; analysis: string }[]> {
  if (references.length === 0) return [];

  const prompt = `Analyze the relevance of each prior art reference to the following claim:

CLAIM TEXT:
${input.claimText}

PRIOR ART REFERENCES:
${references.map((r, i) => `[${i + 1}] ${r.patentNumber ?? "NPL"}: ${r.title}\n${r.abstract.slice(0, 500)}`).join("\n\n")}

For each reference, provide:
1. Relevance score (0-100): How closely does this reference read on the claim?
2. Key distinguishing features: What does the claim have that this reference lacks?
3. Potential rejection type if filed as-is (102/103/N/A)

Output as JSON array: [{"index": 1, "score": 75, "distinguishing": "...", "rejectionType": "103"}]
Return ONLY valid JSON. No markdown fences.`;

  const message = await client.messages.create({
    model:      MODEL,
    max_tokens: 2048,
    system:     SYSTEM_ARMOR + "\nAnalyze prior art relevance. Return ONLY valid JSON. No markdown.",
    messages:   [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "[]";

  await writeLedgerEntry({
    matterId:  input.matterId,
    tenantId:  input.tenantId,
    eventType: "prior_art_searched",
    actorId:   null,
    actorType: "ai",
    aiModelId: MODEL,
    payload:   { referenceCount: references.length, invokingUserId: input.actorId },
  });

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return references.map((r, i) => {
      const analysis = parsed.find((p: any) => p.index === i + 1) ?? { score: 0, distinguishing: "", rejectionType: "N/A" };
      return {
        patentNumber: r.patentNumber,
        title:        r.title,
        relevanceScore: analysis.score ?? 0,
        analysis:     `Rejection type: ${analysis.rejectionType ?? "N/A"}. ${analysis.distinguishing ?? ""}`,
      };
    });
  } catch {
    return references.map(r => ({ patentNumber: r.patentNumber, title: r.title, relevanceScore: 0, analysis: "Analysis unavailable" }));
  }
}
