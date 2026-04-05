import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "../lib/api";
import {
  ArrowLeft, Shield, CheckCircle2, AlertTriangle, MessageSquare,
  Lock, Loader2, Flag, FileCheck, ChevronDown, ChevronRight, XCircle
} from "lucide-react";

export default function CounselPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());
  const [annotation, setAnnotation]   = useState<{ claimId: number; text: string; level: string } | null>(null);
  const [flagForm, setFlagForm]        = useState<{ type: string; desc: string; claimId?: number } | null>(null);
  const [signOffNotes, setSignOffNotes] = useState("");
  const [showSignOff, setShowSignOff]  = useState(false);
  const [signOffError, setSignOffError] = useState("");

  const { data: view, isLoading } = useQuery({
    queryKey: [`/api/counsel/matters/${id}`],
    queryFn:  async () => { const r = await fetch(`/api/counsel/matters/${id}`,{credentials:"include"}); return r.json(); },
  });

  const annotateMutation = useMutation({
    mutationFn: async () => {
      if (!annotation) return;
      const r = await apiRequest("POST", `/api/counsel/matters/${id}/annotate-claim`, {
        claimId: annotation.claimId, annotation: annotation.text, concernLevel: annotation.level,
      });
      return r.json();
    },
    onSuccess: () => setAnnotation(null),
  });

  const flagMutation = useMutation({
    mutationFn: async () => {
      if (!flagForm) return;
      const r = await apiRequest("POST", `/api/counsel/matters/${id}/flag-concern`, {
        concernType: flagForm.type, description: flagForm.desc, claimId: flagForm.claimId,
      });
      return r.json();
    },
    onSuccess: () => setFlagForm(null),
  });

  const readyToFileMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/counsel/matters/${id}/ready-to-file`, { signOffNotes });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/counsel/matters/${id}`] }); setShowSignOff(false); setSignOffError(""); },
    onError: (e: any) => setSignOffError(e.message),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#030407" }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#E5C07B" }} /></div>;

  const { matter, inventors, conceptions, claims, disputes, priorArt, ledgerIntegrity } = (view as any) ?? {};

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      <nav className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Matters
        </Link>
        <span className="text-xs" style={{ color: "#4b5563" }}>/ Counsel Console — Matter {id}</span>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Privilege notice */}
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
          style={{ background: "rgba(229,192,123,0.06)", border: "1px solid rgba(229,192,123,0.2)" }}>
          <Shield className="w-4 h-4 shrink-0" style={{ color: "#E5C07B" }} />
          <p className="text-xs" style={{ color: "#E5C07B" }}>
            <strong>ATTORNEY-CLIENT PRIVILEGED.</strong> This console and all your interactions are logged to
            the Provenance Ledger for privilege documentation. All access is timestamped and attributed.
            Your annotations are "For Counsel Review Only" and do not modify inventor-authored content.
          </p>
        </div>

        {matter && (
          <>
            {/* Matter header */}
            <div className="mb-8 p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded mr-2" style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>{matter.matterId}</span>
                  <span className="text-xs capitalize px-2 py-0.5 rounded" style={{ background: "rgba(229,192,123,0.08)", color: "#E5C07B" }}>{matter.applicationType}</span>
                  <h1 className="text-xl font-semibold text-white mt-2">{matter.title}</h1>
                  {matter.problemStatement && <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>{matter.problemStatement}</p>}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: ledgerIntegrity?.valid ? "#4ade80" : "#f87171" }}>
                    {ledgerIntegrity?.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    Chain {ledgerIntegrity?.valid ? "intact" : "BROKEN"} — {ledgerIntegrity?.totalEntries} entries
                  </div>
                </div>
              </div>

              {/* Open disputes alert */}
              {disputes?.filter((d: any) => d.status === "open").length > 0 && (
                <div className="mt-4 p-3 rounded-lg flex items-center gap-2"
                  style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
                  <p className="text-xs font-medium" style={{ color: "#f87171" }}>
                    {disputes.filter((d: any) => d.status === "open").length} open co-inventorship dispute(s) require resolution before filing.
                  </p>
                </div>
              )}
            </div>

            {/* Claims review */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-white mb-4">Claim Elements ({claims?.length ?? 0} total, {claims?.filter((c: any) => c.status === "accepted").length ?? 0} accepted)</h2>
              <div className="space-y-2">
                {(claims ?? []).filter((c: any) => c.status === "accepted").map((claim: any) => {
                  const open = expandedClaims.has(claim.id);
                  return (
                    <div key={claim.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                      <button onClick={() => setExpandedClaims(s => { const n = new Set(s); open ? n.delete(claim.id) : n.add(claim.id); return n; })}
                        className="w-full flex items-center justify-between px-4 py-3"
                        style={{ background: "rgba(255,255,255,0.02)" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono" style={{ color: "#6b7280" }}>#{claim.elementNumber}</span>
                          <span className="text-sm text-white truncate max-w-xs">{(claim.humanFinalText ?? claim.aiProposedText ?? "").slice(0,60)}…</span>
                          {claim.isPriorityGuardFlagged && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(251,146,60,0.1)", color: "#fb923c" }}>PG flag</span>}
                          {claim.hasDispute && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>Dispute</span>}
                        </div>
                        {open ? <ChevronDown className="w-4 h-4" style={{ color: "#6b7280" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "#6b7280" }} />}
                      </button>
                      {open && (
                        <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          <p className="text-sm text-white mb-3" style={{ lineHeight: 1.7 }}>{claim.humanFinalText ?? claim.aiProposedText}</p>
                          {claim.inventorAttestation && <p className="text-xs italic mb-3" style={{ color: "#9ca3af" }}>Attestation: "{claim.inventorAttestation}"</p>}
                          <div className="flex gap-2">
                            <button onClick={() => setAnnotation({ claimId: claim.id, text: "", level: "none" })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                              <MessageSquare className="w-3.5 h-3.5" />Annotate
                            </button>
                            <button onClick={() => setFlagForm({ type: "inventorship_concern", desc: "", claimId: claim.id })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                              style={{ color: "#fb923c" }}>
                              <Flag className="w-3.5 h-3.5" />Flag concern
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Annotation form */}
            {annotation && (
              <div className="mb-6 p-5 rounded-2xl" style={{ border: "1px solid rgba(229,192,123,0.3)", background: "rgba(229,192,123,0.04)" }}>
                <h3 className="text-sm font-semibold text-white mb-3">Annotate Claim #{annotation.claimId}</h3>
                <select value={annotation.level} onChange={e => setAnnotation(a => a ? {...a, level: e.target.value} : null)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none mb-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <option value="none">No concern</option>
                  <option value="minor">Minor concern — note only</option>
                  <option value="major">Major concern — revise before filing</option>
                  <option value="blocking">Blocking — cannot file as-is</option>
                </select>
                <textarea value={annotation.text} onChange={e => setAnnotation(a => a ? {...a, text: e.target.value} : null)}
                  placeholder="Counsel annotation (privileged)..." rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none mb-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                <div className="flex gap-2">
                  <button onClick={() => annotateMutation.mutate()} disabled={!annotation.text.trim() || annotateMutation.isPending}
                    className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "#E5C07B", color: "#030407" }}>
                    {annotateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save annotation"}
                  </button>
                  <button onClick={() => setAnnotation(null)} className="px-4 py-2 rounded-xl text-sm" style={{ color: "#6b7280" }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Ready to file */}
            <section className="mt-8 p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileCheck className="w-4 h-4" style={{ color: "#E5C07B" }} />
                Counsel Sign-Off
              </h2>
              <p className="text-xs mb-4" style={{ color: "#9ca3af" }}>
                Only you can release this matter for filing. This action is irreversible and permanently logged to the
                Provenance Ledger with your identity and timestamp.
              </p>
              {!showSignOff ? (
                <button onClick={() => setShowSignOff(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: "#E5C07B", color: "#030407" }}>
                  <Lock className="w-4 h-4" />Mark ready to file
                </button>
              ) : (
                <div>
                  <textarea value={signOffNotes} onChange={e => setSignOffNotes(e.target.value)}
                    placeholder="Sign-off notes (optional): any counsel caveats, conditions, or recommendations..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none mb-3"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                  {signOffError && <p className="text-xs mb-3" style={{ color: "#f87171" }}>{signOffError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => readyToFileMutation.mutate()} disabled={readyToFileMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: "#4ade80", color: "#030407" }}>
                      {readyToFileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Confirm — mark ready to file
                    </button>
                    <button onClick={() => { setShowSignOff(false); setSignOffError(""); }}
                      className="px-4 py-2 rounded-xl text-sm" style={{ color: "#6b7280" }}>Cancel</button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
