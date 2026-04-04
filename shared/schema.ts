// ═══════════════════════════════════════════════════════════════════════════
// INVENTORLAB — Database Schema
// PostgreSQL + Drizzle ORM
// ═══════════════════════════════════════════════════════════════════════════

import {
  pgTable, text, timestamp, jsonb, serial, integer,
  boolean, index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ── Enums ────────────────────────────────────────────────────────────────────
export const matterStatusEnum     = pgEnum("matter_status",      ["draft","active","filed","abandoned","abandoned_revived"]);
export const applicationTypeEnum  = pgEnum("application_type",   ["provisional","nonprovisional","continuation","cip","divisional","pct"]);
export const sessionStateEnum     = pgEnum("session_state",       ["conception_open","conception_locked","ai_open","ai_locked","complete"]);
export const claimElementStatusEnum = pgEnum("claim_element_status", ["proposed","accepted","rejected","modified"]);
export const inventorRoleEnum     = pgEnum("inventor_role",       ["sole","joint"]);
export const ledgerEventTypeEnum  = pgEnum("ledger_event_type", [
  "matter_created","conception_submitted","conception_locked","ai_session_opened",
  "ai_session_closed","claim_proposed","claim_accepted","claim_rejected","claim_modified",
  "prior_art_searched","prior_art_annotated","invention_record_generated",
  "esig_requested","esig_completed","filing_started","filing_completed",
  "dispute_flagged","counsel_notified","key_recovery_initiated","key_recovery_completed",
]);

// ── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:              serial("id").primaryKey(),
  email:           text("email").notNull().unique(),
  passwordHash:    text("password_hash").notNull(),
  fullName:        text("full_name").notNull(),
  role:            text("role").notNull().default("inventor"),      // inventor | counsel | admin
  idmeVerified:    boolean("idme_verified").default(false),
  idmeSubject:     text("idme_subject"),                            // ID.me identity claim
  fido2CredentialId: text("fido2_credential_id"),                   // WebAuthn credential
  fido2PublicKey:  text("fido2_public_key"),
  tenantId:        integer("tenant_id"),
  createdAt:       timestamp("created_at").defaultNow(),
  lastLoginAt:     timestamp("last_login_at"),
}, (t) => [
  index("idx_users_email").on(t.email),
  index("idx_users_tenant").on(t.tenantId),
]);

// ── Tenants (multi-tenant) ────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  slug:         text("slug").notNull().unique(),
  tierName:     text("tier_name").notNull().default("solo"),        // solo | professional | enterprise
  awsRegion:    text("aws_region").default("us-east-1"),            // data residency
  isWhiteLabel: boolean("is_white_label").default(false),
  brandName:    text("brand_name"),
  brandLogoUrl: text("brand_logo_url"),
  createdAt:    timestamp("created_at").defaultNow(),
});

// ── Matters ───────────────────────────────────────────────────────────────────
export const matters = pgTable("matters", {
  id:               serial("id").primaryKey(),
  matterId:         text("matter_id").notNull().unique(),            // IL-2026-XXXXXX
  tenantId:         integer("tenant_id").notNull(),
  title:            text("title").notNull(),
  problemStatement: text("problem_statement"),
  applicationType:  applicationTypeEnum("application_type").notNull().default("provisional"),
  parentMatterId:   integer("parent_matter_id"),                     // for continuation/CIP
  isCip:            boolean("is_cip").default(false),
  status:           matterStatusEnum("status").notNull().default("draft"),
  sessionState:     sessionStateEnum("session_state").notNull().default("conception_open"),
  hasFederalFunding: boolean("has_federal_funding").default(false),  // Bayh-Dole flag
  federalAgency:    text("federal_agency"),
  grantNumber:      text("grant_number"),
  privilegeBanner:  boolean("privilege_banner").default(true),
  createdById:      integer("created_by_id").notNull(),
  counselId:        integer("counsel_id"),
  applicationNumber: text("application_number"),                     // after filing
  filingDate:       timestamp("filing_date"),
  createdAt:        timestamp("created_at").defaultNow(),
  updatedAt:        timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_matters_tenant").on(t.tenantId),
  index("idx_matters_status").on(t.status),
  index("idx_matters_parent").on(t.parentMatterId),
]);

// ── Matter Inventors (joint inventorship) ────────────────────────────────────
export const matterInventors = pgTable("matter_inventors", {
  id:         serial("id").primaryKey(),
  matterId:   integer("matter_id").notNull(),
  userId:     integer("user_id").notNull(),
  role:       inventorRoleEnum("role").notNull().default("sole"),
  signedAt:   timestamp("signed_at"),
  fido2SignatureHash: text("fido2_signature_hash"),
  tsa3161Token: text("tsa_3161_token"),                              // RFC 3161 timestamp token (hex)
  tsaSerial:  text("tsa_serial"),
  addedAt:    timestamp("added_at").defaultNow(),
}, (t) => [
  index("idx_matter_inventors_matter").on(t.matterId),
  uniqueIndex("idx_matter_inventors_unique").on(t.matterId, t.userId),
]);

// ── Conception Narratives ─────────────────────────────────────────────────────
export const conceptionNarratives = pgTable("conception_narratives", {
  id:          serial("id").primaryKey(),
  matterId:    integer("matter_id").notNull(),
  inventorId:  integer("inventor_id").notNull(),
  narrative:   text("narrative").notNull(),                          // inventor's own words
  lockedAt:    timestamp("locked_at"),                               // null = still editable
  isLocked:    boolean("is_locked").default(false),
  sha256Hash:  text("sha256_hash"),                                  // hash of narrative at lock time
  tsa3161Token: text("tsa_3161_token"),                              // RFC 3161 token
  tsaSerial:   text("tsa_serial"),
  createdAt:   timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_conception_matter").on(t.matterId),
  uniqueIndex("idx_conception_unique").on(t.matterId, t.inventorId),
]);

// ── Claim Elements ────────────────────────────────────────────────────────────
export const claimElements = pgTable("claim_elements", {
  id:               serial("id").primaryKey(),
  matterId:         integer("matter_id").notNull(),
  elementNumber:    integer("element_number").notNull(),
  aiProposedText:   text("ai_proposed_text"),
  humanFinalText:   text("human_final_text"),
  status:           claimElementStatusEnum("status").notNull().default("proposed"),
  inventorAttestation: text("inventor_attestation"),                 // "I conceived this element"
  attestedById:     integer("attested_by_id"),
  attestedAt:       timestamp("attested_at"),
  sha256Hash:       text("sha256_hash"),
  tsa3161Token:     text("tsa_3161_token"),
  hasDispute:       boolean("has_dispute").default(false),
  isPriorityGuardFlagged: boolean("is_priority_guard_flagged").default(false),
  createdAt:        timestamp("created_at").defaultNow(),
  updatedAt:        timestamp("updated_at").defaultNow(),
}, (t) => [
  index("idx_claim_elements_matter").on(t.matterId),
]);

// ── Co-Inventorship Dispute Log ───────────────────────────────────────────────
export const inventorshipDisputes = pgTable("inventorship_disputes", {
  id:              serial("id").primaryKey(),
  claimElementId:  integer("claim_element_id").notNull(),
  matterId:        integer("matter_id").notNull(),
  flaggedById:     integer("flagged_by_id").notNull(),
  basis:           text("basis").notNull(),                          // inventor's stated basis
  status:          text("status").notNull().default("open"),         // open | resolved | escalated
  counselNotifiedAt: timestamp("counsel_notified_at"),
  resolvedAt:      timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  sha256Hash:      text("sha256_hash"),
  tsa3161Token:    text("tsa_3161_token"),
  createdAt:       timestamp("created_at").defaultNow(),             // immutable — NEVER UPDATE
}, (t) => [
  index("idx_disputes_matter").on(t.matterId),
  index("idx_disputes_status").on(t.status),
]);

// ── Prior Art References ──────────────────────────────────────────────────────
export const priorArtReferences = pgTable("prior_art_references", {
  id:               serial("id").primaryKey(),
  matterId:         integer("matter_id").notNull(),
  patentNumber:     text("patent_number"),
  title:            text("title"),
  abstract:         text("abstract"),
  sourceType:       text("source_type"),                             // patent | npl | other
  sourceUrl:        text("source_url"),
  relevanceScore:   integer("relevance_score"),                      // 0-100
  claimElementIds:  jsonb("claim_element_ids"),                      // which claims this art is relevant to
  annotation:       text("annotation"),                              // human annotation
  annotatedById:    integer("annotated_by_id"),
  annotatedAt:      timestamp("annotated_at"),
  isDistinguishing: boolean("is_distinguishing"),                    // counsel marks true/false
  createdAt:        timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_prior_art_matter").on(t.matterId),
]);

// ── Provenance Ledger (append-only — NEVER UPDATE OR DELETE) ─────────────────
export const provenanceLedger = pgTable("provenance_ledger", {
  id:           serial("id").primaryKey(),
  matterId:     integer("matter_id").notNull(),
  tenantId:     integer("tenant_id").notNull(),
  eventType:    ledgerEventTypeEnum("event_type").notNull(),
  actorId:      integer("actor_id"),                                 // null for system events
  actorType:    text("actor_type").notNull().default("human"),       // human | ai | system
  aiModelId:    text("ai_model_id"),                                 // e.g. claude-sonnet-4-20250514
  payloadHash:  text("payload_hash").notNull(),                      // SHA-256 of payload
  payload:      jsonb("payload").notNull(),                          // full event data
  tsa3161Token: text("tsa_3161_token"),                              // RFC 3161 timestamp (hex)
  tsaSerial:    text("tsa_serial"),
  tsaTimestamp: timestamp("tsa_timestamp"),                          // TSA-confirmed time
  chainHash:    text("chain_hash"),                                  // SHA-256(prev_chain_hash + payload_hash)
  createdAt:    timestamp("created_at").defaultNow(),                // immutable
}, (t) => [
  index("idx_ledger_matter").on(t.matterId),
  index("idx_ledger_created").on(t.createdAt),
  index("idx_ledger_event_type").on(t.eventType),
]);

// ── Invention Records ─────────────────────────────────────────────────────────
export const inventionRecords = pgTable("invention_records", {
  id:           serial("id").primaryKey(),
  matterId:     integer("matter_id").notNull().unique(),
  pdfUrl:       text("pdf_url"),
  pdfSha256:    text("pdf_sha256"),
  tsa3161Token: text("tsa_3161_token"),
  generatedAt:  timestamp("generated_at").defaultNow(),
  signedAt:     timestamp("signed_at"),
  signedByIds:  jsonb("signed_by_ids"),                              // array of user IDs
  status:       text("status").notNull().default("draft"),           // draft | signed | filed
}, (t) => [
  index("idx_invention_records_matter").on(t.matterId),
]);

// ── Zod schemas ───────────────────────────────────────────────────────────────
export const insertMatterSchema = createInsertSchema(matters).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClaimElementSchema = createInsertSchema(claimElements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConceptionSchema = createInsertSchema(conceptionNarratives).omit({ id: true, createdAt: true });
export const insertDisputeSchema = createInsertSchema(inventorshipDisputes).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type Matter = typeof matters.$inferSelect;
export type ClaimElement = typeof claimElements.$inferSelect;
export type ConceptionNarrative = typeof conceptionNarratives.$inferSelect;
export type ProvenanceLedgerEntry = typeof provenanceLedger.$inferSelect;
export type InventorshipDispute = typeof inventorshipDisputes.$inferSelect;
export type PriorArtReference = typeof priorArtReferences.$inferSelect;
export type InventionRecord = typeof inventionRecords.$inferSelect;
