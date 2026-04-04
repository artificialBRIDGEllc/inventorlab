import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "../lib/api";
import { ArrowLeft, Lock, CheckCircle2, AlertTriangle, Loader2, Clock, Shield } from "lucide-react";

export default function ConceptionPage() {
  const { id }      = useParams<{ id: string }>();
  const qc          = useQueryClient();
  const [text, setText] = useState("");

  const { data: cn, isLoading: cnLoading } = useQuery({
    queryKey: [`/api/matters/${id}/conception`],
    queryFn:  async () => {
      const r = await fetch(`/api/matters/${id}/conception`,{credentials:"include"});
      return r.json();
    },
    onSuccess: (data: any) => { if (data?.narrative) setText(data.narrative); },
  } as any);

  const { data: matter } = useQuery({
    queryKey: [`/api/matters/${id}`],
    queryFn:  async () => { const r = await fetch(`/api/matters/${id}`,{credentials:"include"}); return r.json(); },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/conception`, { narrative: text });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/matters/${id}/conception`] }),
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/conception/lock`, {});
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/matters/${id}/conception`] });
      qc.invalidateQueries({ queryKey: [`/api/matters/${id}`] });
    },
  });

  const openAiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/ai-session/open`, {});
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/matters/${id}`] }),
  });

  const isLocked = (cn as any)?.isLocked;

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      <nav className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href={`/matters/${id}`} className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Matter
        </Link>
        <span className="text-xs" style={{ color: "#4b5563" }}>/ Conception Narrative</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white mb-2">Conception Narrative</h1>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            Document your invention in your own words — <strong className="text-white">before</strong> any AI assistance.
            This narrative is timestamped with RFC 3161, FIDO2-signed, and permanently frozen when locked.
            It is the legal anchor of your inventorship record.
          </p>
        </div>

        {/* Warning box */}
        <div className="mb-5 p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(229,192,123,0.06)", border: "1px solid rgba(229,192,123,0.15)" }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#E5C07B" }} />
          <div className="text-xs" style={{ color: "#E5C07B" }}>
            <strong>This session is isolated from AI assistance.</strong> Write what you conceived, in your own words,
            without consulting any AI tool. Once locked, this narrative cannot be modified.
            The lock triggers an RFC 3161 timestamp from an accredited TSA.
          </div>
        </div>

        {isLocked ? (
          // Locked view
          <div className={`p-5 rounded-2xl locked-glow`} style={{ border: "1px solid rgba(229,192,123,0.3)", background: "rgba(229,192,123,0.04)" }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5" style={{ color: "#4ade80" }} />
              <span className="text-sm font-semibold" style={{ color: "#4ade80" }}>Conception locked — RFC 3161 anchored</span>
            </div>
            <div className="text-xs mb-3 flex items-center gap-3" style={{ color: "#6b7280" }}>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Locked: {(cn as any)?.lockedAt ? new Date((cn as any).lockedAt).toLocaleString() : "–"}</span>
              <span className="font-mono">SHA-256: {(cn as any)?.sha256Hash?.slice(0,16)}…</span>
              {(cn as any)?.tsaSerial && <span>TSA: {(cn as any)?.tsaSerial?.slice(0,12)}…</span>}
            </div>
            <div className="p-4 rounded-xl text-sm whitespace-pre-wrap" style={{ background: "rgba(255,255,255,0.03)", color: "#d1d5db", lineHeight: 1.7 }}>
              {(cn as any)?.narrative}
            </div>
            {matter?.sessionState === "conception_locked" && (
              <button onClick={() => openAiMutation.mutate()} disabled={openAiMutation.isPending}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#E5C07B", color: "#030407" }}>
                {openAiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Open AI session for claim drafting
              </button>
            )}
            {matter?.sessionState === "ai_open" && (
              <p className="mt-3 text-xs flex items-center gap-1" style={{ color: "#4ade80" }}>
                <CheckCircle2 className="w-3.5 h-3.5" />AI session open — proceed to Claim Elements
              </p>
            )}
          </div>
        ) : (
          // Editable view
          <>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder={`Describe your invention in your own words.\n\nInclude:\n• When and how the idea came to you\n• What problem you identified\n• The core insight or solution you conceived\n• Any specific technical approaches you developed\n\nThis is your sworn statement of inventorship. Write it as if explaining to a judge.`}
              rows={16}
              className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none resize-none mb-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.7, caretColor: "#E5C07B" }} />

            <div className="flex gap-3">
              <button onClick={() => saveMutation.mutate()} disabled={!text.trim() || saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#F7F7F5", opacity: (!text.trim() || saveMutation.isPending) ? 0.5 : 1 }}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save draft
              </button>
              <button onClick={() => { if (window.confirm("Lock this conception narrative permanently? This cannot be undone.")) lockMutation.mutate(); }}
                disabled={!text.trim() || lockMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#E5C07B", color: "#030407", opacity: (!text.trim() || lockMutation.isPending) ? 0.5 : 1 }}>
                {lockMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Lock & timestamp narrative
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: "#4b5563" }}>
              Locking is irreversible. It triggers RFC 3161 TSA timestamping and permanently closes this session.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
