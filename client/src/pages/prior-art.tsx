import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Search, Loader2, ExternalLink, AlertTriangle, Library } from "lucide-react";
import { apiRequest, fetchJson } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { LoadingState } from "@/components/app/loading-state";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type PriorArt = {
  id: number;
  patentNumber?: string | null;
  title: string;
  abstract?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  relevanceScore: number;
};

type Filter = "all" | "patent" | "npl" | "other";

export default function PriorArtPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [claimText, setClaimText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data: refs = [], isLoading } = useQuery<PriorArt[]>({
    queryKey: [`/api/matters/${id}/prior-art`],
    queryFn: () => fetchJson<PriorArt[]>(`/api/matters/${id}/prior-art`),
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/prior-art/search`, { claimText });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/matters/${id}/prior-art`] }),
  });

  const filtered = useMemo(() => {
    if (filter === "all") return refs;
    return refs.filter((r) => (r.sourceType ?? "patent") === filter);
  }, [refs, filter]);

  const counts = useMemo(() => ({
    all: refs.length,
    patent: refs.filter((r) => (r.sourceType ?? "patent") === "patent").length,
    npl: refs.filter((r) => r.sourceType === "npl").length,
    other: refs.filter((r) => r.sourceType === "other").length,
  }), [refs]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={<span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Step 3 · Prior art</span>}
        title="Prior Art Search"
        description="Search USPTO PatentsView and non-patent literature. Counsel must independently verify all results."
      />

      <Alert variant="warning" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>NOT A FREEDOM-TO-OPERATE OPINION</AlertTitle>
        <AlertDescription>
          These search results are for informational purposes only. Counsel must independently
          verify all prior art before relying on any search result.
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardContent className="p-5">
          <Label htmlFor="claim" className="mb-2 block">Claim text to search against</Label>
          <Textarea
            id="claim"
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
            rows={4}
            placeholder="Paste an accepted claim element or describe the key inventive concept…"
            className="mb-3"
          />
          <Button onClick={() => searchMutation.mutate()} disabled={!claimText.trim() || searchMutation.isPending}>
            {searchMutation.isPending ? <Loader2 className="animate-spin" /> : <Search />}
            Search USPTO PatentsView + NPL
          </Button>
        </CardContent>
      </Card>

      {refs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["all", "patent", "npl", "other"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              <span className="capitalize">{f === "npl" ? "NPL" : f}</span>
              <span className="text-muted-foreground/70">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : refs.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No references yet"
          description="Run a search above to retrieve relevant patents and non-patent literature."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((ref) => (
            <Card key={ref.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      {ref.sourceType && (
                        <Badge variant="outline" className="uppercase text-[0.625rem]">
                          {ref.sourceType === "npl" ? "NPL" : ref.sourceType}
                        </Badge>
                      )}
                      {ref.patentNumber && (
                        <Badge variant="mono">US{ref.patentNumber}</Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-foreground leading-snug">{ref.title}</h3>
                    {ref.abstract && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {ref.abstract}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="text-right">
                      <div
                        className={cn(
                          "font-serif text-2xl font-medium tabular-nums",
                          ref.relevanceScore >= 70
                            ? "text-destructive"
                            : ref.relevanceScore >= 40
                            ? "text-warning"
                            : "text-success"
                        )}
                      >
                        {ref.relevanceScore}
                      </div>
                      <div className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        Relevance
                      </div>
                    </div>
                    {ref.sourceUrl && (
                      <a
                        href={ref.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Open source"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
                <Progress
                  value={ref.relevanceScore}
                  className="mt-4 h-1"
                  indicatorClassName={cn(
                    ref.relevanceScore >= 70
                      ? "bg-destructive"
                      : ref.relevanceScore >= 40
                      ? "bg-warning"
                      : "bg-success"
                  )}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
