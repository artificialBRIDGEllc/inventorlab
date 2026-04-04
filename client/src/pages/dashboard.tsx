import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "../lib/auth";
import { apiRequest } from "../lib/api";
import { FlaskConical, Plus, ArrowRight, Clock, Lock, FileText, Shield, Loader2, LogOut } from "lucide-react";

type Matter = {
  id: number; matterId: string; title: string; applicationType: string;
  status: string; sessionState: string; hasFederalFunding: boolean;
  createdAt: string;
};

const SESSION_STATE_LABELS: Record<string, { label: string; color: string }> = {
  conception_open:   { label: "Conception open",   color: "#60a5fa" },
  conception_locked: { label: "Conception locked", color: "#E5C07B" },
  ai_open:           { label: "AI session open",   color: "#4ade80" },
  ai_locked:         { label: "AI session locked", color: "#fb923c" },
  complete:          { label: "Complete",           color: "#4ade80" },
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle]     = useState("");
  const [problem, setProblem] = useState("");
  const [appType, setAppType] = useState("provisional");
  const [fedFunding, setFedFunding] = useState(false);

  const { data: matters = [], isLoading } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
    queryFn: async () => { const r = await fetch("/api/matters",{credentials:"include"}); return r.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/matters", {
        title, problemStatement: problem, applicationType: appType, hasFederalFunding: fedFunding,
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/matters"] }); setShowNew(false); setTitle(""); setProblem(""); },
  });

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5" style={{ color: "#E5C07B" }} />
          <span className="font-bold text-white">InventorLab</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "#6b7280" }}>{user?.fullName}</span>
          <button onClick={() => logout()} className="text-xs flex items-center gap-1.5 transition-colors" style={{ color: "#6b7280" }}>
            <LogOut className="w-3.5 h-3.5" />Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Matters</h1>
            <p className="text-sm" style={{ color: "#6b7280" }}>{matters.length} invention record{matters.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "#E5C07B", color: "#030407" }}>
            <Plus className="w-4 h-4" />New Matter
          </button>
        </div>

        {/* New matter form */}
        {showNew && (
          <div className="mb-6 p-5 rounded-2xl" style={{ border: "1px solid rgba(229,192,123,0.3)", background: "rgba(229,192,123,0.04)" }}>
            <h2 className="text-sm font-semibold text-white mb-4">Create new matter</h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#9ca3af" }}>Invention title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief descriptive title"
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "#9ca3af" }}>Problem statement</label>
                <textarea value={problem} onChange={e => setProblem(e.target.value)} rows={3}
                  placeholder="What problem does this invention solve?"
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#9ca3af" }}>Application type</label>
                  <select value={appType} onChange={e => setAppType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <option value="provisional">Provisional</option>
                    <option value="nonprovisional">Nonprovisional</option>
                    <option value="continuation">Continuation</option>
                    <option value="cip">Continuation-in-Part (CIP)</option>
                    <option value="divisional">Divisional</option>
                    <option value="pct">PCT International</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="fedFunding" checked={fedFunding} onChange={e => setFedFunding(e.target.checked)}
                    className="w-4 h-4 rounded" />
                  <label htmlFor="fedFunding" className="text-xs" style={{ color: "#9ca3af" }}>Federal funding (Bayh-Dole)</label>
                </div>
              </div>
              {fedFunding && (
                <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                  ⚠️ Bayh-Dole flag active. AI-assisted claim drafting will be disabled for this matter. Human-authored conception only.
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMutation.mutate()} disabled={!title || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "#E5C07B", color: "#030407", opacity: (!title || createMutation.isPending) ? 0.5 : 1 }}>
                {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create matter
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: "#6b7280" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Matters list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#E5C07B" }} /></div>
        ) : matters.length === 0 ? (
          <div className="text-center py-20">
            <FlaskConical className="w-10 h-10 mx-auto mb-4" style={{ color: "#4b5563" }} />
            <p className="text-white font-medium mb-2">No matters yet</p>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Each invention starts as a matter. Create one to begin capturing your evidence chain.</p>
            <button onClick={() => setShowNew(true)} className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "#E5C07B", color: "#030407" }}>
              <Plus className="w-4 h-4" />Create your first matter
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {matters.map(m => {
              const stateInfo = SESSION_STATE_LABELS[m.sessionState] ?? { label: m.sessionState, color: "#6b7280" };
              return (
                <Link key={m.id} href={`/matters/${m.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all group"
                    style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-medium text-white">{m.title}</span>
                        {m.hasFederalFunding && <Shield className="w-3.5 h-3.5" style={{ color: "#fb923c" }} title="Bayh-Dole federal funding" />}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af" }}>{m.matterId}</span>
                        <span className="text-xs capitalize" style={{ color: "#6b7280" }}>{m.applicationType}</span>
                        <span className="text-xs flex items-center gap-1" style={{ color: stateInfo.color }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: stateInfo.color }} />
                          {stateInfo.label}
                        </span>
                        <span className="text-xs flex items-center gap-1" style={{ color: "#4b5563" }}>
                          <Clock className="w-3 h-3" />{new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#E5C07B" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
