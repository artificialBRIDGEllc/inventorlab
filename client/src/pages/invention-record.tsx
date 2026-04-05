import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "../lib/api";
import {
  ArrowLeft, FileText, Download, Loader2, CheckCircle2,
  AlertTriangle, Shield, Lock, ExternalLink, Zap,
} from "lucide-react";

type RecordData = {
  matter:        any;
  inventors:     any[];
  conception:    any | null;
  claims:        any[];
  priorArt:      any[];
  ledgerSummary: { totalEntries: number; aiCallCount: number; humanActionCount: number; lastChainHash: string | null; lastTsaSerial: string | null; };
  generatedAt:   string;
  recordHash:    string;
  tsaSerial:     string | null;
  disclaimer:    string;
};

type PriorityGuardResult = {
  overallStatus:      string;
  recommendation:     string;
  uncoveredClaims:    any[];
  cipNewMatterItems:  any[];
  coveredByParent:    number;
  totalCurrentClaims: number;
};

const PG_STATUS_CFG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  CLEAR:         { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  icon: <CheckCircle2 className="w-4 h-4" /> },
  GAP_DETECTED:  { color: "#f87171", bg: "rgba(248,113,113,0.08)", icon: <AlertTriangle className="w-4 h-4" /> },
  CIP_NEW_MATTER:{ color: "#E5C07B", bg: "rgba(229,192,123,0.08)", icon: <AlertTriangle className="w-4 h-4" /> },
  NO_PARENT:     { color: "#6b7280", bg: "rgba(107,114,128,0.08)", icon: <Shield className="w-4 h-4" /> },
};

export default function InventionRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"record" | "priority-guard">("record");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/invention-record/generate`, {});
      return r.json();
    },
  });

  const { data: pg, isLoading: pgLoading } = useQuery<PriorityGuardResult>({
    queryKey: [`/api/matters/${id}/priority-guard`],
    queryFn:  async () => {
      const r = await fetch(`/api/matters/${id}/priority-guard`, { credentials: "include" });
      return r.json();
    },
    enabled: activeTab === "priority-guard",
  });

  const record: RecordData | undefined = generateMutation.data;

  const openHtmlRecord = () => {
    window.open(`/api/matters/${id}/invention-record/html`, "_blank");
  };

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      <nav className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href={`/matters/${id}`} className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Matter
        </Link>
        <span className="text-xs" style={{ color: "#4b5563" }}>/ Invention Record</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-white mb-1">Invention Record</h1>
            <p className="text-sm" style={{ color: "#9ca3af" }}>
              RFC 3161-anchored summary document. Generate, review, then send to counsel for sign-off.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["record", "priority-guard"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                background: activeTab === tab ? "rgba(229,192,123,0.15)" : "transparent",
                border: `1px solid ${activeTab === tab ? "rgba(229,192,123,0.4)" : "rgba(255,255,255,0.06)"}`,
                color: activeTab === tab ? "#E5C07B" : "#6b7280",
              }}>
              {tab === "record" ? "Invention Record" : "Priority Guard"}
            </button>
          ))}
        </div>

        {activeTab === "record" && (
          <>
            {/* Disclaimer */}
            <div className="mb-5 p-4 rounded-xl flex items-start gap-3"
              style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.2)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#fb923c" }} />
              <p className="text-xs" style={{ color: "#fb923c" }}>
                <strong>DRAFT — For Counsel Review Only.</strong> Not a legal opinion. All outputs require
                independent attorney review before use in patent prosecution.
              </p>
            </div>

            {!record ? (
              <div className="text-center py-16 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: "#4b5563" }} />
                <h2 className="text-white font-medium mb-2">Generate Invention Record</h2>
                <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "#6b7280" }}>
                  Compiles your conception narrative, accepted claim elements, prior art summary,
                  and full provenance ledger into a RFC 3161-anchored document.
                </p>
                <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "#E5C07B", color: "#030407", opacity: generateMutation.isPending ? 0.5 : 1 }}>
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {generateMutation.isPending ? "Generating..." : "Generate record"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Record summary */}
                <div className="p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5" style={{ color: "#4ade80" }} />
                    <span className="text-sm font-semibold text-white">Invention Record generated</span>
                    {record.tsaSerial && (
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                        RFC 3161 TSA ✓
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Inventors",  value: record.inventors.length },
                      { label: "Claims",     value: record.claims.length },
                      { label: "Prior art",  value: record.priorArt.length },
                      { label: "Ledger entries", value: record.ledgerSummary.totalEntries },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl text-center"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div className="text-xl font-bold text-white">{s.value}</div>
                        <div className="text-xs" style={{ color: "#6b7280" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 text-xs font-mono" style={{ color: "#6b7280" }}>
                    <div>Record hash: <span style={{ color: "#9ca3af" }}>{record.recordHash}</span></div>
                    {record.tsaSerial && <div>TSA serial: <span style={{ color: "#4ade80" }}>{record.tsaSerial}</span></div>}
                    <div>Last chain hash: <span style={{ color: "#9ca3af" }}>{record.ledgerSummary.lastChainHash?.slice(0,32)}…</span></div>
                    <div>Generated: <span style={{ color: "#9ca3af" }}>{new Date(record.generatedAt).toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={openHtmlRecord}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: "#E5C07B", color: "#030407" }}>
                    <ExternalLink className="w-4 h-4" />
                    View / Print to PDF
                  </button>
                  <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
                    style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                    <Loader2 className={`w-4 h-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>

                <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", color: "#4b5563" }}>
                  To produce the final signed PDF: Open the record, review all sections, then use your browser's
                  print function (Ctrl+P / Cmd+P) → "Save as PDF". The printed document includes all hash values,
                  TSA serial, and signature blocks for wet or DocuSign execution.
                </div>
              </div>
            )}

            {generateMutation.isError && (
              <div className="mt-4 p-3 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                {(generateMutation.error as Error).message}
              </div>
            )}
          </>
        )}

        {activeTab === "priority-guard" && (
          <>
            {pgLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#E5C07B" }} />
              </div>
            ) : pg ? (
              <div className="space-y-4">
                {/* Status banner */}
                {(() => {
                  const cfg = PG_STATUS_CFG[pg.overallStatus] ?? PG_STATUS_CFG.NO_PARENT;
                  return (
                    <div className="p-5 rounded-2xl flex items-start gap-3"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                      <div style={{ color: cfg.color, marginTop: 1 }}>{cfg.icon}</div>
                      <div>
                        <div className="font-semibold text-sm mb-1" style={{ color: cfg.color }}>
                          Priority Guard: {pg.overallStatus.replace(/_/g, " ")}
                        </div>
                        <p className="text-xs" style={{ color: "#d1d5db", lineHeight: 1.6 }}>{pg.recommendation}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Coverage stats */}
                {pg.totalCurrentClaims > 0 && (
                  <div className="p-4 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-white">Parent coverage</span>
                      <span className="text-xs" style={{ color: "#6b7280" }}>
                        {pg.coveredByParent}/{pg.totalCurrentClaims} claims covered
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ background: pg.uncoveredClaims.length > 0 ? "#f87171" : "#4ade80",
                                 width: `${pg.totalCurrentClaims > 0 ? (pg.coveredByParent/pg.totalCurrentClaims)*100 : 0}%` }} />
                    </div>
                  </div>
                )}

                {/* Gap items */}
                {pg.uncoveredClaims.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" style={{ color: "#f87171" }} />
                      Priority Date Gaps ({pg.uncoveredClaims.length})
                    </h3>
                    {pg.uncoveredClaims.map((gap: any, i: number) => (
                      <div key={i} className="p-4 rounded-xl mb-2"
                        style={{ border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.04)" }}>
                        <div className="text-xs font-medium mb-1" style={{ color: "#f87171" }}>
                          Claim Element #{gap.elementNumber}
                        </div>
                        <div className="text-sm text-white mb-2 line-clamp-2">{gap.claimText}</div>
                        <p className="text-xs" style={{ color: "#9ca3af", lineHeight: 1.6 }}>{gap.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* CIP new matter items */}
                {pg.cipNewMatterItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" style={{ color: "#E5C07B" }} />
                      CIP New Matter ({pg.cipNewMatterItems.length})
                    </h3>
                    {pg.cipNewMatterItems.map((item: any, i: number) => (
                      <div key={i} className="p-4 rounded-xl mb-2"
                        style={{ border: "1px solid rgba(229,192,123,0.2)", background: "rgba(229,192,123,0.04)" }}>
                        <div className="text-xs font-medium mb-1" style={{ color: "#E5C07B" }}>
                          Claim Element #{item.elementNumber} — CIP new matter
                        </div>
                        <div className="text-sm text-white mb-2 line-clamp-2">{item.claimText}</div>
                        <p className="text-xs" style={{ color: "#9ca3af", lineHeight: 1.6 }}>{item.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
