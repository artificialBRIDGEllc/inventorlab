// ═══════════════════════════════════════════════════════════════════════════
// Shared status/color configurations.
// Single source of truth for badge + pill + timeline rendering across pages.
// ═══════════════════════════════════════════════════════════════════════════

import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export type StatusConfig = {
  label: string;
  variant: BadgeVariant;
  /** Tailwind color class keyed to a token (for dot indicators, gutter rails, etc.) */
  dotClass: string;
};

// ── Matter session state ────────────────────────────────────────────────────
export const SESSION_STATE: Record<string, StatusConfig> = {
  conception_open:   { label: "Conception open",   variant: "info",    dotClass: "bg-info" },
  conception_locked: { label: "Conception locked", variant: "gold",    dotClass: "bg-gold" },
  ai_open:           { label: "AI session open",   variant: "success", dotClass: "bg-success" },
  ai_locked:         { label: "AI session locked", variant: "warning", dotClass: "bg-warning" },
  complete:          { label: "Complete",          variant: "success", dotClass: "bg-success" },
};

export const SESSION_STATE_FALLBACK: StatusConfig = {
  label: "Unknown",
  variant: "secondary",
  dotClass: "bg-muted-foreground",
};

export function getSessionState(key: string | undefined | null): StatusConfig {
  if (!key) return SESSION_STATE_FALLBACK;
  return SESSION_STATE[key] ?? { ...SESSION_STATE_FALLBACK, label: key };
}

// ── Claim element status ────────────────────────────────────────────────────
export const CLAIM_STATUS: Record<string, StatusConfig> = {
  proposed: { label: "Proposed", variant: "gold",        dotClass: "bg-gold" },
  accepted: { label: "Accepted", variant: "success",     dotClass: "bg-success" },
  rejected: { label: "Rejected", variant: "destructive", dotClass: "bg-destructive" },
  modified: { label: "Modified", variant: "info",        dotClass: "bg-info" },
};

export function getClaimStatus(key: string | undefined | null): StatusConfig {
  if (!key) return SESSION_STATE_FALLBACK;
  return CLAIM_STATUS[key] ?? { ...SESSION_STATE_FALLBACK, label: key };
}

// ── Ledger event types ──────────────────────────────────────────────────────
export const LEDGER_EVENT: Record<string, StatusConfig> = {
  matter_created:             { label: "Matter created",            variant: "info",        dotClass: "bg-info" },
  conception_submitted:       { label: "Conception submitted",      variant: "info",        dotClass: "bg-info" },
  conception_locked:          { label: "Conception locked",         variant: "gold",        dotClass: "bg-gold" },
  ai_session_opened:          { label: "AI session opened",         variant: "success",     dotClass: "bg-success" },
  ai_session_closed:          { label: "AI session closed",         variant: "warning",     dotClass: "bg-warning" },
  claim_proposed:             { label: "Claim proposed",            variant: "warning",     dotClass: "bg-warning" },
  claim_accepted:             { label: "Claim accepted",            variant: "success",     dotClass: "bg-success" },
  claim_rejected:             { label: "Claim rejected",            variant: "destructive", dotClass: "bg-destructive" },
  claim_modified:             { label: "Claim modified",            variant: "info",        dotClass: "bg-info" },
  prior_art_searched:         { label: "Prior art searched",        variant: "info",        dotClass: "bg-info" },
  prior_art_annotated:        { label: "Prior art annotated",       variant: "info",        dotClass: "bg-info" },
  invention_record_generated: { label: "Invention record generated",variant: "gold",        dotClass: "bg-gold" },
  esig_requested:             { label: "eSig requested",            variant: "gold",        dotClass: "bg-gold" },
  esig_completed:             { label: "eSig completed",            variant: "success",     dotClass: "bg-success" },
  filing_started:             { label: "Filing started",            variant: "gold",        dotClass: "bg-gold" },
  filing_completed:           { label: "Filing completed",          variant: "success",     dotClass: "bg-success" },
  dispute_flagged:            { label: "Dispute flagged",           variant: "destructive", dotClass: "bg-destructive" },
  counsel_notified:           { label: "Counsel notified",          variant: "warning",     dotClass: "bg-warning" },
  key_recovery_initiated:     { label: "Key recovery initiated",    variant: "warning",     dotClass: "bg-warning" },
  key_recovery_completed:     { label: "Key recovery completed",    variant: "success",     dotClass: "bg-success" },
};

export function getLedgerEvent(key: string | undefined | null): StatusConfig {
  if (!key) return SESSION_STATE_FALLBACK;
  return LEDGER_EVENT[key] ?? {
    ...SESSION_STATE_FALLBACK,
    label: (key ?? "").replace(/_/g, " "),
  };
}

// ── Priority Guard status ───────────────────────────────────────────────────
export const PG_STATUS: Record<string, StatusConfig> = {
  CLEAR:          { label: "Clear",          variant: "success",     dotClass: "bg-success" },
  GAP_DETECTED:   { label: "Gap detected",   variant: "destructive", dotClass: "bg-destructive" },
  CIP_NEW_MATTER: { label: "CIP new matter", variant: "gold",        dotClass: "bg-gold" },
  NO_PARENT:      { label: "No parent",      variant: "secondary",   dotClass: "bg-muted-foreground" },
};

export function getPgStatus(key: string | undefined | null): StatusConfig {
  if (!key) return SESSION_STATE_FALLBACK;
  return PG_STATUS[key] ?? { ...SESSION_STATE_FALLBACK, label: (key ?? "").replace(/_/g, " ") };
}

// ── Counsel concern level ───────────────────────────────────────────────────
export const CONCERN_LEVEL: Record<string, StatusConfig> = {
  none:     { label: "No concern",   variant: "secondary",    dotClass: "bg-muted-foreground" },
  minor:    { label: "Minor",        variant: "info",         dotClass: "bg-info" },
  major:    { label: "Major",        variant: "warning",      dotClass: "bg-warning" },
  blocking: { label: "Blocking",     variant: "destructive",  dotClass: "bg-destructive" },
};

// ── Application types ───────────────────────────────────────────────────────
export const APPLICATION_TYPE: Record<string, string> = {
  provisional:    "Provisional",
  nonprovisional: "Nonprovisional",
  continuation:   "Continuation",
  cip:            "Continuation-in-Part",
  divisional:     "Divisional",
  pct:            "PCT International",
};
