import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import {
  ShieldCheck, ShieldAlert, Clock, User, Bot, Zap, ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { LoadingState } from "@/components/app/loading-state";
import { EmptyState } from "@/components/app/empty-state";
import { ShaChip } from "@/components/app/sha-chip";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getLedgerEvent } from "@/lib/status";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api";

type Entry = {
  id: number;
  eventType: string;
  actorType: "human" | "ai" | "system";
  aiModelId: string | null;
  payloadHash: string;
  chainHash: string;
  tsaSerial: string | null;
  createdAt: string;
};

type ActorFilter = "all" | "human" | "ai" | "system";

export default function LedgerPage() {
  const { id } = useParams<{ id: string }>();
  const [actorFilter, setActorFilter] = useState<ActorFilter>("all");

  const { data: entries = [], isLoading } = useQuery<Entry[]>({
    queryKey: [`/api/matters/${id}/ledger`],
    queryFn: () => fetchJson<Entry[]>(`/api/matters/${id}/ledger`),
  });

  const { data: integrity } = useQuery<any>({
    queryKey: [`/api/matters/${id}/ledger/verify`],
    queryFn: () => fetchJson<any>(`/api/matters/${id}/ledger/verify`),
  });

  const filtered = useMemo(
    () => (actorFilter === "all" ? entries : entries.filter((e) => e.actorType === actorFilter)),
    [entries, actorFilter]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={<span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Provenance</span>}
        title="Provenance Ledger"
        description="Append-only. Chain-hash linked. RFC 3161 TSA-anchored. Tamper-evident."
        actions={
          integrity && (
            <Badge
              variant={integrity.valid ? "success" : "destructive"}
              className="gap-1.5 px-2.5 py-1"
            >
              {integrity.valid ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {integrity.valid
                ? `Chain intact · ${integrity.totalEntries}`
                : `Chain broken @ ${integrity.firstBrokenAt}`}
            </Badge>
          )
        }
      />

      {/* Actor filter */}
      {entries.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["all", "human", "ai", "system"] as ActorFilter[]).map((a) => (
            <button
              key={a}
              onClick={() => setActorFilter(a)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                actorFilter === a
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              <span className="capitalize">{a}</span>
              <span className="text-muted-foreground/70">
                {a === "all" ? entries.length : entries.filter((e) => e.actorType === a).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No ledger entries yet"
          description="Every action on this matter will be written here, timestamped, and chain-hashed."
        />
      ) : (
        <ol className="relative space-y-0.5 pl-6">
          <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border" aria-hidden />
          {filtered.map((entry) => {
            const cfg = getLedgerEvent(entry.eventType);
            const ActorIcon = entry.actorType === "ai" ? Bot : entry.actorType === "system" ? Zap : User;
            return (
              <li key={entry.id} className="relative animate-fade-in pb-4">
                <span
                  className={cn(
                    "absolute -left-[19px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                    cfg.dotClass
                  )}
                  aria-hidden
                />
                <div className="rounded-md border border-border bg-card/40 p-3.5 transition-colors hover:border-border/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      {cfg.label}
                    </span>
                    <span className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                      <ActorIcon className="h-3 w-3" />
                      <span className="capitalize">{entry.actorType}</span>
                      {entry.aiModelId && (
                        <span className="font-mono text-muted-foreground/70">· {entry.aiModelId.slice(0, 24)}</span>
                      )}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-auto flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{format(new Date(entry.createdAt), "PPpp")}</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ShaChip label="payload" value={entry.payloadHash} />
                    <ShaChip label="chain" value={entry.chainHash} />
                    {entry.tsaSerial && <Badge variant="success">TSA ✓</Badge>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
