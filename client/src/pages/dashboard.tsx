import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  FlaskConical, Plus, ArrowRight, Clock, Shield, Search, FileCheck,
  BookOpen, CheckCircle2, Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getSessionState, APPLICATION_TYPE } from "@/lib/status";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Matter = {
  id: number;
  matterId: string;
  title: string;
  applicationType: string;
  status: string;
  sessionState: string;
  hasFederalFunding: boolean;
  createdAt: string;
};

export default function DashboardPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: matters = [], isLoading } = useQuery<Matter[]>({
    queryKey: ["/api/matters"],
    queryFn: async () => {
      const r = await fetch("/api/matters", { credentials: "include" });
      return r.json();
    },
  });

  const kpis = useMemo(() => {
    const inConception = matters.filter((m) => m.sessionState === "conception_open").length;
    const awaitingCounsel = matters.filter((m) => m.sessionState === "ai_locked").length;
    const complete = matters.filter((m) => m.sessionState === "complete").length;
    return { total: matters.length, inConception, awaitingCounsel, complete };
  }, [matters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return matters.filter((m) => {
      if (stateFilter !== "all" && m.sessionState !== stateFilter) return false;
      if (typeFilter !== "all" && m.applicationType !== typeFilter) return false;
      if (q && !(m.title.toLowerCase().includes(q) || m.matterId.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [matters, search, stateFilter, typeFilter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={<span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Workspace</span>}
        title="Matters"
        description="Each invention starts as a matter. Every action here is timestamped, hashed, and written to the provenance ledger."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus /> New matter
              </Button>
            </DialogTrigger>
            <NewMatterDialog onSuccess={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["/api/matters"] }); }} />
          </Dialog>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <KpiCard icon={FlaskConical} label="Total matters" value={kpis.total} />
        <KpiCard icon={BookOpen} label="In conception" value={kpis.inConception} accent />
        <KpiCard icon={FileCheck} label="Awaiting counsel" value={kpis.awaitingCounsel} />
        <KpiCard icon={CheckCircle2} label="Complete" value={kpis.complete} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or matter ID…"
            className="pl-9"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="All states" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="conception_open">Conception open</SelectItem>
            <SelectItem value="conception_locked">Conception locked</SelectItem>
            <SelectItem value="ai_open">AI session open</SelectItem>
            <SelectItem value="ai_locked">AI session locked</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(APPLICATION_TYPE).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <LoadingState />
      ) : matters.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No matters yet"
          description="Each invention starts as a matter. Create one to begin capturing your evidence chain."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus /> Create your first matter
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matters match your filters" description="Try adjusting your search or clearing filters." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((m) => {
            const state = getSessionState(m.sessionState);
            return (
              <Link key={m.id} href={`/matters/${m.id}`}>
                <Card className="group cursor-pointer transition-all hover:border-gold/30 hover:bg-card/80">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="mono">{m.matterId}</Badge>
                          <Badge variant="outline" className="capitalize">{APPLICATION_TYPE[m.applicationType] ?? m.applicationType}</Badge>
                          {m.hasFederalFunding && (
                            <Badge variant="warning"><Shield className="h-3 w-3" />Bayh-Dole</Badge>
                          )}
                        </div>
                        <h3 className="truncate font-medium text-foreground leading-snug">{m.title}</h3>
                        <div className="mt-3 flex items-center gap-3 text-[0.6875rem] text-muted-foreground">
                          <StatusPill config={state} />
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:text-gold" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={accent ? "h-4 w-4 text-gold" : "h-4 w-4 text-muted-foreground"} />
        </div>
        <p className="mt-2 font-serif text-3xl font-medium tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function NewMatterDialog({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [appType, setAppType] = useState("provisional");
  const [fedFunding, setFedFunding] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/matters", {
        title,
        problemStatement: problem,
        applicationType: appType,
        hasFederalFunding: fedFunding,
      });
      return r.json();
    },
    onSuccess: () => {
      setTitle(""); setProblem(""); setAppType("provisional"); setFedFunding(false);
      onSuccess();
    },
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Create new matter</DialogTitle>
        <DialogDescription>Every matter begins in <span className="text-gold">conception_open</span> state.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">Invention title *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief descriptive title" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="problem">Problem statement</Label>
          <Textarea id="problem" value={problem} onChange={(e) => setProblem(e.target.value)} rows={3}
            placeholder="What problem does this invention solve?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="type">Application type</Label>
            <Select value={appType} onValueChange={setAppType}>
              <SelectTrigger id="type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(APPLICATION_TYPE).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 pb-1.5">
            <input
              id="fed"
              type="checkbox"
              checked={fedFunding}
              onChange={(e) => setFedFunding(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-border bg-input text-primary focus:ring-1 focus:ring-ring"
            />
            <Label htmlFor="fed" className="text-xs">Federal funding (Bayh-Dole)</Label>
          </div>
        </div>
        {fedFunding && (
          <Alert variant="warning">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Bayh-Dole flag active. AI-assisted claim drafting will be disabled for this matter.
              Human-authored conception only.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <DialogFooter>
        <Button onClick={() => createMutation.mutate()} disabled={!title || createMutation.isPending}>
          {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Create matter
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
