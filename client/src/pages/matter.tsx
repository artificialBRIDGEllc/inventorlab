import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { FlaskConical, ArrowLeft, Lock, Brain, FileText, Search, BookOpen, Shield, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import type { Matter } from "@shared/schema";

const WORKFLOW_STEPS = [
  { href: "conception",       label: "Conception Narrative",  icon: <BookOpen  className="w-4 h-4" />, requiresConception: false },
  { href: "claims",           label: "Claim Elements",        icon: <Brain     className="w-4 h-4" />, requiresConception: true },
  { href: "prior-art",        label: "Prior Art Search",      icon: <Search    className="w-4 h-4" />, requiresConception: true },
  { href: "invention-record", label: "Invention Record",      icon: <FileText  className="w-4 h-4" />, requiresConception: true },
  { href: "counsel",          label: "Counsel Console",       icon: <Gavel     className="w-4 h-4" />, requiresConception: true },
  { href: "ledger",           label: "Provenance Ledger",     icon: <Lock      className="w-4 h-4" />, requiresConception: false },
];

export default function MatterPage() {
  const { id } = useParams<{ id: string }>();
  const { data: matter, isLoading } = useQuery<Matter>({
    queryKey: [`/api/matters/${id}`],
    queryFn: async () => { const r = await fetch(`/api/matters/${id}`,{credentials:"include"}); return r.json(); },
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#030407" }}>Loading...</div>;
  if (!matter)   return <div className="min-h-screen flex items-center justify-center" style={{ background: "#030407" }}>Matter not found</div>;

  const isConceptionLocked = !["conception_open"].includes(matter.sessionState);
  const isAiOpen = ["ai_open","ai_locked","complete"].includes(matter.sessionState);

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      <nav className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: "#6b7280" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Matters
        </Link>
        <ChevronRight className="w-3 h-3" style={{ color: "#4b5563" }} />
        <span className="text-xs text-white">{matter.title}</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Matter header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>{matter.matterId}</span>
                <span className="text-xs capitalize px-2 py-0.5 rounded" style={{ background: "rgba(229,192,123,0.08)", color: "#E5C07B" }}>{matter.applicationType}</span>
                {matter.hasFederalFunding && (
                  <span className="text-xs px-2 py-0.5 rounded flex items-center gap-1" style={{ background: "rgba(251,146,60,0.1)", color: "#fb923c" }}>
                    <Shield className="w-3 h-3" />Bayh-Dole
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-semibold text-white">{matter.title}</h1>
              {matter.problemStatement && <p className="text-sm mt-2" style={{ color: "#9ca3af" }}>{matter.problemStatement}</p>}
            </div>
          </div>
        </div>

        {/* Bayh-Dole warning */}
        {matter.hasFederalFunding && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)" }}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#fb923c" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "#fb923c" }}>Bayh-Dole Federal Funding Active</p>
              <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                AI-assisted claim drafting is disabled. All conception narratives and claim elements must be human-authored.
                Federal funding disclosure required in patent application.
              </p>
            </div>
          </div>
        )}

        {/* Workflow steps */}
        <div className="space-y-3">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isAvailable = !step.requiresConception || isConceptionLocked;

            return (
              <Link key={step.href} href={`/matters/${id}/${step.href}`}>
                <div className={`flex items-center justify-between p-4 rounded-xl transition-all ${isAvailable ? "cursor-pointer group" : "opacity-40 cursor-not-allowed"}`}
                  style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: "rgba(229,192,123,0.08)", color: "#E5C07B" }}>
                      {step.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{step.label}</p>
                      <p className="text-xs" style={{ color: "#6b7280" }}>
                        {step.href === "conception"       && (isConceptionLocked ? "Locked — RFC 3161 anchored" : "Required first — document your conception")}
                        {step.href === "claims"           && (isConceptionLocked ? "AI-assisted drafting available" : "Lock conception first")}
                        {step.href === "prior-art"        && (isConceptionLocked ? "USPTO PatentsView + NPL search" : "Lock conception first")}
                        {step.href === "invention-record" && (isConceptionLocked ? "Generate RFC 3161-anchored PDF + Priority Guard" : "Lock conception first")}
                        {step.href === "counsel"          && (isConceptionLocked ? "Privileged attorney review + ready-to-file gate" : "Lock conception first")}
                        {step.href === "ledger"           && "Append-only chain-hash provenance log"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {step.href === "conception" && isConceptionLocked && <CheckCircle2 className="w-4 h-4" style={{ color: "#4ade80" }} />}
                    {isAvailable && <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#E5C07B" }} />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
