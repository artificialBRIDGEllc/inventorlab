import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, ShieldCheck, ShieldAlert, Clock, User, Bot, Zap, Loader2 } from "lucide-react";

const EVENT_COLORS: Record<string, string> = {
  matter_created:             "#60a5fa",
  conception_submitted:       "#a78bfa",
  conception_locked:          "#E5C07B",
  ai_session_opened:          "#4ade80",
  claim_proposed:             "#fb923c",
  claim_accepted:             "#4ade80",
  claim_rejected:             "#f87171",
  claim_modified:             "#fbbf24",
  prior_art_searched:         "#60a5fa",
  invention_record_generated: "#E5C07B",
  dispute_flagged:            "#f87171",
  counsel_notified:           "#fb923c",
  default:                    "#6b7280",
};

export default function LedgerPage() {
  const { id } = useParams<{ id: string }>();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: [`/api/matters/${id}/ledger`],
    queryFn:  async () => { const r = await fetch(`/api/matters/${id}/ledger`,{credentials:"include"}); return r.json(); },
  });

  const { data: integrity } = useQuery({
    queryKey: [`/api/matters/${id}/ledger/verify`],
    queryFn:  async () => { const r = await fetch(`/api/matters/${id}/ledger/verify`,{credentials:"include"}); return r.json(); },
  });

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      <nav className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href={`/matters/${id}`} className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Matter
        </Link>
        <span className="text-xs" style={{ color: "#4b5563" }}>/ Provenance Ledger</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-white mb-1">Provenance Ledger</h1>
            <p className="text-sm" style={{ color: "#9ca3af" }}>Append-only. Chain-hash linked. RFC 3161 TSA-anchored. Tamper-evident.</p>
          </div>
          {integrity && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: integrity.valid ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${integrity.valid ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, color: integrity.valid ? "#4ade80" : "#f87171" }}>
              {integrity.valid ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
              {integrity.valid ? `Chain intact — ${integrity.totalEntries} entries` : `Chain broken at entry ${integrity.firstBrokenAt}`}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#E5C07B" }} /></div>
        ) : entries.length === 0 ? (
          <p className="text-center py-20 text-sm" style={{ color: "#6b7280" }}>No ledger entries yet. Create a matter to begin.</p>
        ) : (
          <div className="space-y-2">
            {(entries as any[]).map((entry: any, idx: number) => {
              const color = EVENT_COLORS[entry.eventType] ?? EVENT_COLORS.default;
              return (
                <div key={entry.id} className="flex gap-4 p-4 rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
                    {idx < entries.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: "rgba(255,255,255,0.06)" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-medium" style={{ color }}>
                        {entry.eventType.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#4b5563" }}>
                        {entry.actorType === "ai" ? <Bot className="w-3 h-3" /> : entry.actorType === "system" ? <Zap className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {entry.actorType}
                        {entry.aiModelId && <span className="font-mono">{entry.aiModelId.slice(0,20)}</span>}
                      </span>
                      <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: "#4b5563" }}>
                        <Clock className="w-3 h-3" />
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "#6b7280" }}>
                      <span className="font-mono truncate">payload: {entry.payloadHash?.slice(0,16)}…</span>
                      <span className="font-mono truncate">chain: {entry.chainHash?.slice(0,16)}…</span>
                      {entry.tsaSerial && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80" }}>TSA ✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
