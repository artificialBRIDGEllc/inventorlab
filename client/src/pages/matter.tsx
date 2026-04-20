import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { FlaskConical, ArrowLeft, Lock, Brain, FileText, Search, BookOpen, Shield, ChevronRight, CheckCircle2, AlertTriangle, Gavel } from "lucide-react";
import type { Matter } from "@shared/schema";
import { PageHeader } from "@/components/app/page-header";
import { LoadingState } from "@/components/app/loading-state";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getSessionState, APPLICATION_TYPE } from "@/lib/status";

type Step = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresConception: boolean;
  descLocked: string;
  descOpen: string;
};

const STEPS: Step[] = [
  { href: "conception",       label: "Conception Narrative", icon: BookOpen, requiresConception: false,
    descOpen:"Required first — document your conception in your own words.",
    descLocked:"Locked · RFC 3161 anchored." },
  { href: "claims",           label: "Claim Elements",       icon: Brain,    requiresConception: true,
    descOpen:"Lock conception first.", descLocked:"AI-assisted drafting available." },
  { href: "prior-art",        label: "Prior Art Search",     icon: Search,   requiresConception: true,
    descOpen:"Lock conception first.", descLocked:"USPTO PatentsView + NPL search." },
  { href: "invention-record", label: "Invention Record",     icon: FileText, requiresConception: true,
    descOpen:"Lock conception first.", descLocked:"Generate RFC 3161 PDF + Priority Guard." },
  { href: "counsel",          label: "Counsel Console",      icon: Gavel,    requiresConception: true,
    descOpen:"Lock conception first.", descLocked:"Privileged attorney review + ready-to-file gate." },
  { href: "ledger",           label: "Provenance Ledger",    icon: Lock,     requiresConception: false,
    descOpen:"Append-only chain-hash provenance log.",
    descLocked:"Append-only chain-hash provenance log." },
];

const STEP_ORDER = ["conception", "claims", "prior-art", "invention-record", "counsel"];

export default function MatterPage() {
  const { id } = useParams<{ id: string }>();
  const { data: matter, isLoading } = useQuery<Matter>({
    queryKey: [`/api/matters/${id}`],
    queryFn: async () => {
      const r = await fetch(`/api/matters/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    },
  });

  if (isLoading) return <LoadingState />;
  if (!matter) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <EmptyState icon={AlertTriangle} title="Matter not found" />
      </div>
    );
  }

  const isConceptionLocked = matter.sessionState !== "conception_open";
  const state = getSessionState(matter.sessionState);

  // Workflow progress: derive highest completed step
  const progressIndex = (() => {
    if (matter.sessionState === "complete") return STEP_ORDER.length;
    if (matter.sessionState === "ai_locked") return 4;
    if (matter.sessionState === "ai_open") return 2;
    if (matter.sessionState === "conception_locked") return 1;
    return 0;
  })();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="mono">{matter.matterId}</Badge>
            <Badge variant="outline" className="capitalize">
              {APPLICATION_TYPE[matter.applicationType] ?? matter.applicationType}
            </Badge>
            {matter.hasFederalFunding && (
              <Badge variant="warning"><Shield className="h-3 w-3" />Bayh-Dole</Badge>
            )}
            <StatusPill config={state} />
          </div>
        }
        title={matter.title}
        description={matter.problemStatement ?? undefined}
      />

      {matter.hasFederalFunding && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Bayh-Dole Federal Funding Active</AlertTitle>
          <AlertDescription>
            AI-assisted claim drafting is disabled. All conception narratives and claim elements must be human-authored.
            Federal funding disclosure required in patent application.
          </AlertDescription>
        </Alert>
      )}

      {/* Progress tracker */}
      <div className="mb-8 rounded-lg border border-border bg-card/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
            Workflow progress
          </span>
          <span className="text-xs text-muted-foreground">
            {Math.min(progressIndex, STEP_ORDER.length)} / {STEP_ORDER.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {STEP_ORDER.map((slug, i) => {
            const isDone = i < progressIndex;
            const isCurrent = i === progressIndex;
            return (
              <div key={slug} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.625rem] font-semibold",
                    isDone
                      ? "border-gold bg-gold text-primary-foreground"
                      : isCurrent
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1 transition-colors",
                      i < progressIndex - 1 ? "bg-gold/60" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Workflow step cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isAvailable = !step.requiresConception || isConceptionLocked;
          const isConceptionCard = step.href === "conception" && isConceptionLocked;
          return (
            <Link
              key={step.href}
              href={isAvailable ? `/matters/${id}/${step.href}` : "#"}
              aria-disabled={!isAvailable}
              onClick={(e) => !isAvailable && e.preventDefault()}
            >
              <Card
                className={cn(
                  "group h-full transition-all",
                  isAvailable
                    ? "cursor-pointer hover:border-gold/40 hover:bg-card/80"
                    : "opacity-40 cursor-not-allowed"
                )}
              >
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                        isConceptionCard ? "bg-success/15 text-success" : "bg-gold/10 text-gold"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{step.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {(step.href === "conception" && isConceptionLocked) || (step.href !== "conception" && isAvailable)
                          ? step.descLocked
                          : step.descOpen}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-all",
                      isAvailable && "group-hover:text-gold group-hover:translate-x-0.5"
                    )}
                  />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
