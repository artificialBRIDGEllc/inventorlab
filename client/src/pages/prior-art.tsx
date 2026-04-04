import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "../lib/api";
import { ArrowLeft, Search, Loader2, ExternalLink, AlertTriangle } from "lucide-react";

export default function PriorArtPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [claimText, setClaimText] = useState("");

  const { data: refs = [], isLoading } = useQuery({
    queryKey: [`/api/matters/${id}/prior-art`],
    queryFn:  async () => { const r = await fetch(`/api/matters/${id}/prior-art`,{credentials:"include"}); return r.json(); },
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/prior-art/search`, { claimText });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/matters/${id}/prior-art`] }),
  });

  return (
    <div className="min-h-screen" style={{ background: "#030407" }}>
      <nav className="flex items-center gap-2 px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href={`/matters/${id}`} className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7280" }}>
          <ArrowLeft className="w-3.5 h-3.5" />Matter
        </Link>
        <span className="text-xs" style={{ color: "#4b5563" }}>/ Prior Art Search</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white mb-2">Prior Art Search</h1>
          <div className="p-3 rounded-xl flex items-start gap-2" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)" }}>
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#fb923c" }} />
            <p className="text-xs font-medium" style={{ color: "#fb923c" }}>
              NOT A FREEDOM-TO-OPERATE OPINION. These search results are for informational purposes only.
              Counsel must independently verify all prior art before relying on any search result.
            </p>
          </div>
        </div>

        <div className="mb-6 p-5 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <label className="text-xs font-medium block mb-2" style={{ color: "#9ca3af" }}>Claim text to search against</label>
          <textarea value={claimText} onChange={e => setClaimText(e.target.value)} rows={4}
            placeholder="Paste an accepted claim element or describe the key inventive concept..."
            className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none mb-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          <button onClick={() => searchMutation.mutate()} disabled={!claimText.trim() || searchMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#E5C07B", color: "#030407", opacity: (!claimText.trim() || searchMutation.isPending) ? 0.5 : 1 }}>
            {searchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search USPTO PatentsView + NPL
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "#E5C07B" }} /></div>
        ) : (refs as any[]).length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "#6b7280" }}>No references yet. Run a search above.</p>
        ) : (
          <div className="space-y-3">
            {(refs as any[]).map((ref: any) => (
              <div key={ref.id} className="p-4 rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{ref.title}</p>
                    {ref.patentNumber && <p className="text-xs font-mono mt-0.5" style={{ color: "#E5C07B" }}>US{ref.patentNumber}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: ref.relevanceScore >= 70 ? "#f87171" : ref.relevanceScore >= 40 ? "#fb923c" : "#4ade80" }}>
                        {ref.relevanceScore}
                      </div>
                      <div className="text-xs" style={{ color: "#6b7280" }}>relevance</div>
                    </div>
                    {ref.sourceUrl && (
                      <a href={ref.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#6b7280" }}>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
                {ref.abstract && <p className="text-xs mt-2 line-clamp-3" style={{ color: "#6b7280", lineHeight: 1.6 }}>{ref.abstract}</p>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
