import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "../lib/api";
import { ArrowLeft, Brain, Loader2, CheckCircle2, XCircle, Edit3, AlertTriangle, Plus, Flag } from "lucide-react";

type ClaimElement = {
  id: number; elementNumber: number; aiProposedText: string | null;
  humanFinalText: string | null; status: string; hasDispute: boolean;
  attestedAt: string | null;
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  proposed: { color: "#E5C07B", bg: "rgba(229,192,123,0.1)",  label: "Proposed" },
  accepted: { color: "#4ade80", bg: "rgba(74,222,128,0.1)",   label: "Accepted" },
  rejected: { color: "#f87171", bg: "rgba(248,113,113,0.1)",  label: "Rejected" },
  modified: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",   label: "Modified" },
};

export default function ClaimsPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [instruction, setInstruction]     = useState("");
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [editText, setEditText]           = useState("");
  const [attestation, setAttestation]     = useState("");
  const [disputeId, setDisputeId]         = useState<number | null>(null);
  const [disputeBasis, setDisputeBasis]   = useState("");
  const [error, setError]                 = useState("");

  const { data: matter } = useQuery({
    queryKey: [`/api/matters/${id}`],
    queryFn:  async () => { const r = await fetch(`/api/matters/${id}`,{credentials:"include"}); return r.json(); },
  });

  const { data: claims = [], isLoading } = useQuery<ClaimElement[]>({
    queryKey: [`/api/matters/${id}/claims`],
    queryFn:  async () => { const r = await fetch(`/api/matters/${id}/claims`,{credentials:"include"}); return r.json(); },
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/claims/draft`, { instruction: instruction || undefined });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/matters/${id}/claims`] }); setInstruction(""); setError(""); },
    onError: (e: any) => setError(e.message),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ elementId, action, humanFinalText, att }: { elementId: number; action: string; humanFinalText?: string; att?: string }) => {
      const r = await apiRequest("PATCH", `/api/matters/${id}/claims/${elementId}`, {
        action, humanFinalText: humanFinalText ?? null, attestation: att ?? null,
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/matters/${id}/claims`] }); setEditingId(null); setAttestation(""); },
  });

  const disputeMutation = useMutation({
    mutationFn: async ({ claimElementId, basis }: { claimElementId: number; basis: string }) => {
      const r = await apiRequest("POST", `/api/matters/${id}/disputes`, { claimElementId, basis });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/matters/${id}/claims`] }); setDisputeId(null); setDisputeBasis(""); },
  });

  const aiDisabled = matter?.hasFederalFunding;
  const aiOpen     = matter?.sessionState === "ai_open" || matter?.sessionState === "ai_locked";

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      <nav className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href={`/matters/${id}`} className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Matter
        </Link>
        <span className="text-xs" style={{ color: "#4b5563" }}>/ Claim Elements</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-white mb-1">Claim Elements</h1>
            <p className="text-sm" style={{ color: "#9ca3af" }}>
              AI proposes — you decide. Every accepted element is timestamped and attested.
              DRAFT — For Counsel Review Only.
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(229,192,123,0.08)", color: "#E5C07B" }}>
            {claims.filter(c => c.status === "accepted").length} accepted
          </span>
        </div>

        {aiDisabled && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)" }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#fb923c" }} />
            <p className="text-xs" style={{ color: "#fb923c" }}>
              <strong>Bayh-Dole restriction active.</strong> AI-assisted drafting is disabled for federally-funded matters.
              Add claim elements manually below.
            </p>
          </div>
        )}

        {/* Draft new element */}
        {!aiDisabled && aiOpen && (
          <div className="mb-6 p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <label className="text-xs font-medium block mb-2" style={{ color: "#9ca3af" }}>
              Instruction (optional — describe what element to draft)
            </label>
            <div className="flex gap-2">
              <input value={instruction} onChange={e => setInstruction(e.target.value)}
                placeholder="e.g. Draft the independent method claim for the decay function..."
                onKeyDown={e => e.key === "Enter" && draftMutation.mutate()}
                className="flex-1 px-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
              <button onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#E5C07B", color: "#030407", opacity: draftMutation.isPending ? 0.5 : 1 }}>
                {draftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Draft
              </button>
            </div>
            {error && <p className="text-xs mt-2" style={{ color: "#f87171" }}>{error}</p>}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#E5C07B" }} /></div>
        ) : claims.length === 0 ? (
          <div className="text-center py-20">
            <Brain className="w-10 h-10 mx-auto mb-4" style={{ color: "#4b5563" }} />
            <p className="text-sm" style={{ color: "#6b7280" }}>{aiOpen ? "Draft your first claim element above." : "Lock your conception narrative first to enable claim drafting."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map(claim => {
              const cfg = STATUS_CFG[claim.status] ?? STATUS_CFG.proposed;
              return (
                <div key={claim.id} className="p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold" style={{ color: "#6b7280" }}>#{claim.elementNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                      {claim.hasDispute && <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}><Flag className="w-3 h-3" />Disputed</span>}
                    </div>
                    {claim.attestedAt && <span className="text-xs" style={{ color: "#4b5563" }}>Attested {new Date(claim.attestedAt).toLocaleDateString()}</span>}
                  </div>

                  {editingId === claim.id ? (
                    <div className="space-y-3">
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={5}
                        className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(229,192,123,0.3)" }} />
                      <input value={attestation} onChange={e => setAttestation(e.target.value)}
                        placeholder="Attestation: I conceived this element independently..."
                        className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
                      <div className="flex gap-2">
                        <button onClick={() => actionMutation.mutate({ elementId: claim.id, action: "accept", humanFinalText: editText, att: attestation })}
                          disabled={!editText.trim() || !attestation.trim() || actionMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background: "#4ade80", color: "#030407", opacity: (!editText.trim() || !attestation.trim()) ? 0.5 : 1 }}>
                          <CheckCircle2 className="w-3.5 h-3.5" />Accept & attest
                        </button>
                        <button onClick={() => actionMutation.mutate({ elementId: claim.id, action: "modify", humanFinalText: editText, att: attestation })}
                          disabled={!editText.trim() || actionMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                          <Edit3 className="w-3.5 h-3.5" />Save modified
                        </button>
                        <button onClick={() => actionMutation.mutate({ elementId: claim.id, action: "reject" })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                          style={{ color: "#f87171" }}>
                          <XCircle className="w-3.5 h-3.5" />Reject
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "#6b7280" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm whitespace-pre-wrap mb-3 p-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.02)", color: "#d1d5db", lineHeight: 1.7, fontFamily: claim.status === "accepted" ? "inherit" : "'JetBrains Mono',monospace", fontSize: claim.status !== "accepted" ? "0.75rem" : "0.875rem" }}>
                        {claim.humanFinalText ?? claim.aiProposedText}
                      </div>
                      {claim.status === "proposed" && (
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingId(claim.id); setEditText(claim.aiProposedText ?? ""); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                            style={{ border: "1px solid rgba(229,192,123,0.3)", color: "#E5C07B" }}>
                            <Edit3 className="w-3.5 h-3.5" />Review & act
                          </button>
                        </div>
                      )}
                      {claim.status === "accepted" && !claim.hasDispute && (
                        <button onClick={() => setDisputeId(claim.id)}
                          className="flex items-center gap-1.5 text-xs mt-2 transition-colors" style={{ color: "#4b5563" }}>
                          <Flag className="w-3 h-3" />Flag attribution dispute
                        </button>
                      )}
                    </>
                  )}

                  {disputeId === claim.id && (
                    <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
                      <p className="text-xs font-medium" style={{ color: "#f87171" }}>Log co-inventorship attribution dispute</p>
                      <textarea value={disputeBasis} onChange={e => setDisputeBasis(e.target.value)} rows={2}
                        placeholder="State your basis for this dispute in good faith..."
                        className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none resize-none"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(248,113,113,0.3)" }} />
                      <div className="flex gap-2">
                        <button onClick={() => disputeMutation.mutate({ claimElementId: claim.id, basis: disputeBasis })}
                          disabled={!disputeBasis.trim() || disputeMutation.isPending}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#f87171", color: "#030407" }}>
                          Submit dispute — counsel notified within 15 min
                        </button>
                        <button onClick={() => setDisputeId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "#6b7280" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
