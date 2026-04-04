// ═══════════════════════════════════════════════════════════════════════════
// INVENTORLAB — API Routes
// ═══════════════════════════════════════════════════════════════════════════

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { requireAuth, requireCounsel, hashPassword, verifyPassword, getUserById } from "./auth";
import { writeLedgerEntry, getLedgerForMatter, verifyChainIntegrity } from "./ledger";
import { sha256, requestRfc3161Timestamp } from "./crypto";
import { draftClaimElement, analyzePriorArtRelevance } from "./ai";
import {
  users, matters, matterInventors, conceptionNarratives,
  claimElements, inventorshipDisputes, priorArtReferences,
  inventionRecords, provenanceLedger,
} from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod";

export function registerRoutes(app: Express) {

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "healthy", service: "inventorlab", version: "1.0.0" }));

  // ── Auth ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, fullName, role = "inventor" } = req.body;
      if (!email || !password || !fullName) return res.status(400).json({ error: "email, password, fullName required" });
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length) return res.status(409).json({ error: "Email already registered" });
      const [user] = await db.insert(users).values({
        email, fullName, role,
        passwordHash: await hashPassword(password),
      }).returning();
      req.session.userId   = user.id;
      req.session.userRole = user.role;
      req.session.email    = user.email;
      res.status(201).json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      req.session.userId   = user.id;
      req.session.userRole = user.role;
      req.session.email    = user.email;
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      res.json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role, idmeVerified: user.idmeVerified });
  });

  // ── Matters ───────────────────────────────────────────────────────────────
  app.get("/api/matters", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(matters).where(eq(matters.createdById, req.session.userId!)).orderBy(desc(matters.createdAt));
      res.json(rows);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post("/api/matters", requireAuth, async (req, res) => {
    try {
      const { title, problemStatement, applicationType = "provisional", hasFederalFunding = false, federalAgency, grantNumber } = req.body;
      if (!title) return res.status(400).json({ error: "title required" });

      const matterId = `IL-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      const tenantId = req.session.tenantId ?? 1;

      const [matter] = await db.insert(matters).values({
        matterId, title, problemStatement: problemStatement ?? null,
        applicationType, hasFederalFunding, federalAgency: federalAgency ?? null,
        grantNumber: grantNumber ?? null,
        createdById: req.session.userId!, tenantId,
      }).returning();

      // Add creator as inventor
      await db.insert(matterInventors).values({ matterId: matter.id, userId: req.session.userId!, role: "sole" });

      // Write ledger entry
      await writeLedgerEntry({
        matterId: matter.id, tenantId,
        eventType: "matter_created",
        actorId: req.session.userId!, actorType: "human",
        payload: { matterId: matter.matterId, title, applicationType, hasFederalFunding },
      });

      res.status(201).json(matter);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.get("/api/matters/:id", requireAuth, async (req, res) => {
    try {
      const [matter] = await db.select().from(matters).where(eq(matters.id, parseInt(req.params.id))).limit(1);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      res.json(matter);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // ── Conception Narrative ──────────────────────────────────────────────────
  app.get("/api/matters/:id/conception", requireAuth, async (req, res) => {
    try {
      const [cn] = await db.select().from(conceptionNarratives)
        .where(and(eq(conceptionNarratives.matterId, parseInt(req.params.id)), eq(conceptionNarratives.inventorId, req.session.userId!)))
        .limit(1);
      res.json(cn ?? null);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post("/api/matters/:id/conception", requireAuth, async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const { narrative } = req.body;
      if (!narrative?.trim()) return res.status(400).json({ error: "narrative required" });

      // Check matter session state — must be conception_open
      const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      if (matter.sessionState !== "conception_open") {
        return res.status(409).json({ error: "Conception session is not open. State: " + matter.sessionState });
      }

      // Check if already exists
      const [existing] = await db.select().from(conceptionNarratives)
        .where(and(eq(conceptionNarratives.matterId, matterId), eq(conceptionNarratives.inventorId, req.session.userId!)))
        .limit(1);

      if (existing?.isLocked) return res.status(409).json({ error: "Conception narrative is locked and cannot be modified." });

      if (existing) {
        const [updated] = await db.update(conceptionNarratives)
          .set({ narrative })
          .where(eq(conceptionNarratives.id, existing.id))
          .returning();
        return res.json(updated);
      }

      const [cn] = await db.insert(conceptionNarratives).values({
        matterId, inventorId: req.session.userId!, narrative,
      }).returning();
      res.status(201).json(cn);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // LOCK conception — irreversible, opens AI session
  app.post("/api/matters/:id/conception/lock", requireAuth, async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const [cn] = await db.select().from(conceptionNarratives)
        .where(and(eq(conceptionNarratives.matterId, matterId), eq(conceptionNarratives.inventorId, req.session.userId!)))
        .limit(1);

      if (!cn)           return res.status(404).json({ error: "No conception narrative found" });
      if (cn.isLocked)   return res.status(409).json({ error: "Already locked" });
      if (!cn.narrative?.trim()) return res.status(400).json({ error: "Cannot lock empty narrative" });

      const hash     = sha256(cn.narrative);
      const tsaResult = await requestRfc3161Timestamp(hash);
      const tenantId = req.session.tenantId ?? 1;

      const [locked] = await db.update(conceptionNarratives).set({
        isLocked: true, lockedAt: new Date(),
        sha256Hash: hash,
        tsa3161Token: tsaResult?.token ?? null,
        tsaSerial:   tsaResult?.serial ?? null,
      }).where(eq(conceptionNarratives.id, cn.id)).returning();

      // Advance matter session state
      await db.update(matters).set({ sessionState: "conception_locked" }).where(eq(matters.id, matterId));

      await writeLedgerEntry({
        matterId, tenantId, eventType: "conception_locked",
        actorId: req.session.userId!, actorType: "human",
        payload: { narrativeHash: hash, tsaSerial: tsaResult?.serial, narrativeLength: cn.narrative.length },
      });

      res.json({ ok: true, lockedAt: locked.lockedAt, hash, tsaSerial: tsaResult?.serial });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Open AI session (after conception lock)
  app.post("/api/matters/:id/ai-session/open", requireAuth, async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
      if (!matter) return res.status(404).json({ error: "Matter not found" });
      if (matter.sessionState !== "conception_locked") {
        return res.status(409).json({ error: "Conception must be locked before opening AI session" });
      }

      await db.update(matters).set({ sessionState: "ai_open" }).where(eq(matters.id, matterId));
      await writeLedgerEntry({
        matterId, tenantId: req.session.tenantId ?? 1, eventType: "ai_session_opened",
        actorId: req.session.userId!, actorType: "human",
        payload: { openedByUserId: req.session.userId },
      });
      res.json({ ok: true, sessionState: "ai_open" });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // ── Claim Elements ────────────────────────────────────────────────────────
  app.get("/api/matters/:id/claims", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(claimElements)
        .where(eq(claimElements.matterId, parseInt(req.params.id)))
        .orderBy(asc(claimElements.elementNumber));
      res.json(rows);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Draft a new claim element via AI
  app.post("/api/matters/:id/claims/draft", requireAuth, async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
      if (!matter) return res.status(404).json({ error: "Matter not found" });

      // BAYH-DOLE: No AI drafting for federally-funded matters
      if (matter.hasFederalFunding) {
        return res.status(403).json({
          error: "AI-assisted claim drafting is disabled for federally-funded matters (Bayh-Dole compliance). Please draft claims manually.",
          code: "BAYH_DOLE_RESTRICTION",
        });
      }

      if (!["ai_open","ai_locked"].includes(matter.sessionState)) {
        return res.status(409).json({ error: "AI session is not open. Lock conception first." });
      }

      // Get conception narrative
      const [cn] = await db.select().from(conceptionNarratives)
        .where(and(eq(conceptionNarratives.matterId, matterId), eq(conceptionNarratives.inventorId, req.session.userId!)))
        .limit(1);
      if (!cn?.isLocked) return res.status(409).json({ error: "Conception narrative must be locked before AI drafting" });

      // Get existing accepted elements
      const existing = await db.select().from(claimElements)
        .where(and(eq(claimElements.matterId, matterId), eq(claimElements.status, "accepted")));

      const { instruction } = req.body;
      const draft = await draftClaimElement({
        matterId, tenantId: req.session.tenantId ?? 1,
        actorId: req.session.userId!,
        conceptionNarrative: cn.narrative,
        problemStatement: matter.problemStatement ?? "",
        existingElements: existing.map(e => e.humanFinalText ?? e.aiProposedText ?? ""),
        instruction,
      });

      // Get next element number
      const elementNumber = (existing.length) + 1;
      const [element] = await db.insert(claimElements).values({
        matterId, elementNumber,
        aiProposedText: draft,
        status: "proposed",
      }).returning();

      res.status(201).json(element);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // Accept / reject / modify a claim element
  app.patch("/api/matters/:id/claims/:elementId", requireAuth, async (req, res) => {
    try {
      const matterId  = parseInt(req.params.id);
      const elementId = parseInt(req.params.elementId);
      const { action, humanFinalText, attestation } = req.body;
      // action: "accept" | "reject" | "modify"

      if (!["accept","reject","modify"].includes(action)) {
        return res.status(400).json({ error: "action must be accept, reject, or modify" });
      }

      const tenantId    = req.session.tenantId ?? 1;
      const finalText   = humanFinalText || null;
      const hash        = finalText ? sha256(finalText) : null;
      const tsaResult   = hash ? await requestRfc3161Timestamp(hash) : null;

      const status = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "modified";

      const [updated] = await db.update(claimElements).set({
        status, humanFinalText: finalText,
        inventorAttestation: attestation ?? null,
        attestedById: action !== "reject" ? req.session.userId! : null,
        attestedAt:   action !== "reject" ? new Date() : null,
        sha256Hash:   hash,
        tsa3161Token: tsaResult?.token ?? null,
        updatedAt:    new Date(),
      }).where(eq(claimElements.id, elementId)).returning();

      await writeLedgerEntry({
        matterId, tenantId,
        eventType: action === "accept" ? "claim_accepted" : action === "reject" ? "claim_rejected" : "claim_modified",
        actorId: req.session.userId!, actorType: "human",
        payload: { elementId, action, finalTextHash: hash, tsaSerial: tsaResult?.serial, attestation },
      });

      res.json(updated);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // ── Inventorship Disputes ─────────────────────────────────────────────────
  app.post("/api/matters/:id/disputes", requireAuth, async (req, res) => {
    try {
      const matterId  = parseInt(req.params.id);
      const { claimElementId, basis } = req.body;
      if (!claimElementId || !basis) return res.status(400).json({ error: "claimElementId and basis required" });

      const tenantId = req.session.tenantId ?? 1;
      const hash     = sha256(JSON.stringify({ claimElementId, basis, flaggedById: req.session.userId, timestamp: new Date().toISOString() }));
      const tsaResult = await requestRfc3161Timestamp(hash);

      const [dispute] = await db.insert(inventorshipDisputes).values({
        matterId, claimElementId,
        flaggedById: req.session.userId!,
        basis, status: "open",
        sha256Hash: hash,
        tsa3161Token: tsaResult?.token ?? null,
      }).returning();

      // Flag the claim element
      await db.update(claimElements).set({ hasDispute: true }).where(eq(claimElements.id, claimElementId));

      await writeLedgerEntry({
        matterId, tenantId, eventType: "dispute_flagged",
        actorId: req.session.userId!, actorType: "human",
        payload: { claimElementId, basis, disputeId: dispute.id },
      });

      // 72-hour counsel notification (logged — actual email in production)
      await writeLedgerEntry({
        matterId, tenantId, eventType: "counsel_notified",
        actorId: null, actorType: "system",
        payload: { disputeId: dispute.id, notificationType: "attribution_conflict_alert", slaHours: 72 },
      });

      // Update dispute with counsel notification time
      await db.update(inventorshipDisputes)
        .set({ counselNotifiedAt: new Date() })
        .where(eq(inventorshipDisputes.id, dispute.id));

      res.status(201).json(dispute);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.get("/api/matters/:id/disputes", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(inventorshipDisputes)
        .where(eq(inventorshipDisputes.matterId, parseInt(req.params.id)))
        .orderBy(desc(inventorshipDisputes.createdAt));
      res.json(rows);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // ── Provenance Ledger ─────────────────────────────────────────────────────
  app.get("/api/matters/:id/ledger", requireAuth, async (req, res) => {
    try {
      const entries = await getLedgerForMatter(parseInt(req.params.id));
      res.json(entries);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.get("/api/matters/:id/ledger/verify", requireAuth, async (req, res) => {
    try {
      const result = await verifyChainIntegrity(parseInt(req.params.id));
      res.json(result);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // ── Prior Art ─────────────────────────────────────────────────────────────
  app.get("/api/matters/:id/prior-art", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(priorArtReferences)
        .where(eq(priorArtReferences.matterId, parseInt(req.params.id)))
        .orderBy(desc(priorArtReferences.relevanceScore));
      res.json(rows);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.post("/api/matters/:id/prior-art/search", requireAuth, async (req, res) => {
    try {
      const matterId  = parseInt(req.params.id);
      const { claimText } = req.body;
      if (!claimText) return res.status(400).json({ error: "claimText required" });

      // USPTO PatentsView search (free, no key)
      const query = encodeURIComponent(JSON.stringify({ _contains: { patent_title: claimText.slice(0,60) } }));
      let references: { title: string; abstract: string; patentNumber?: string }[] = [];

      try {
        const res2 = await fetch(
          `https://search.patentsview.org/api/v1/patent?q=${query}&f=["patent_id","patent_title","patent_abstract"]&o={"per_page":10}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (res2.ok) {
          const data = await res2.json() as { patents?: { patent_id: string; patent_title: string; patent_abstract?: string }[] };
          references = (data.patents ?? []).map(p => ({
            title: p.patent_title,
            abstract: p.patent_abstract ?? "",
            patentNumber: p.patent_id,
          }));
        }
      } catch { /* PatentsView unavailable — continue with empty */ }

      // AI relevance analysis
      const analyzed = references.length > 0
        ? await analyzePriorArtRelevance({ matterId, tenantId: req.session.tenantId ?? 1, actorId: req.session.userId!, claimText }, references)
        : [];

      // Store results
      const inserted = [];
      for (const a of analyzed) {
        const [row] = await db.insert(priorArtReferences).values({
          matterId,
          patentNumber: a.patentNumber ?? null,
          title: a.title,
          abstract: references.find(r => r.patentNumber === a.patentNumber)?.abstract ?? "",
          sourceType: "patent",
          sourceUrl: a.patentNumber ? `https://patents.google.com/patent/US${a.patentNumber}` : null,
          relevanceScore: a.relevanceScore,
        }).returning();
        inserted.push({ ...row, aiAnalysis: a.analysis });
      }

      res.json({
        count: inserted.length,
        disclaimer: "NOT A FREEDOM-TO-OPERATE OPINION. These results are for informational purposes only. Counsel must independently verify all prior art searches.",
        references: inserted,
      });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  // ── Invention Record ──────────────────────────────────────────────────────
  app.post("/api/matters/:id/invention-record", requireAuth, async (req, res) => {
    try {
      const matterId = parseInt(req.params.id);
      const [matter] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1);
      if (!matter) return res.status(404).json({ error: "Matter not found" });

      const [cn]       = await db.select().from(conceptionNarratives).where(and(eq(conceptionNarratives.matterId, matterId), eq(conceptionNarratives.isLocked, true))).limit(1);
      const claims     = await db.select().from(claimElements).where(and(eq(claimElements.matterId, matterId), eq(claimElements.status, "accepted")));
      const inventors  = await db.select().from(matterInventors).where(eq(matterInventors.matterId, matterId));
      const ledger     = await getLedgerForMatter(matterId);

      const recordData = {
        matterId: matter.matterId, title: matter.title,
        generatedAt: new Date().toISOString(),
        inventors: inventors.length,
        claimsAccepted: claims.length,
        ledgerEntries: ledger.length,
        conceptionHash: cn?.sha256Hash,
        conceptionTsaSerial: cn?.tsaSerial,
        lastChainHash: ledger[ledger.length - 1]?.chainHash ?? null,
      };

      const recordHash  = sha256(JSON.stringify(recordData));
      const tsaResult   = await requestRfc3161Timestamp(recordHash);
      const tenantId    = req.session.tenantId ?? 1;

      const [existing] = await db.select().from(inventionRecords).where(eq(inventionRecords.matterId, matterId)).limit(1);
      let record;
      if (existing) {
        [record] = await db.update(inventionRecords).set({
          pdfSha256: recordHash, tsa3161Token: tsaResult?.token ?? null,
          generatedAt: new Date(), status: "draft",
        }).where(eq(inventionRecords.id, existing.id)).returning();
      } else {
        [record] = await db.insert(inventionRecords).values({
          matterId, pdfSha256: recordHash,
          tsa3161Token: tsaResult?.token ?? null,
          status: "draft",
        }).returning();
      }

      await writeLedgerEntry({
        matterId, tenantId, eventType: "invention_record_generated",
        actorId: req.session.userId!, actorType: "human",
        payload: { recordHash, tsaSerial: tsaResult?.serial, claimsCount: claims.length },
      });

      res.json({ ...record, recordData, disclaimer: "DRAFT — For Counsel Review Only. Not a legal opinion." });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
}
