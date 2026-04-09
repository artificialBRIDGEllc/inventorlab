import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Shield, CheckCircle2, AlertTriangle, MessageSquare, Lock, Loader2,
  Flag, FileCheck, XCircle, Gavel,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { LoadingState } from "@/components/app/loading-state";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-pill";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { getClaimStatus, APPLICATION_TYPE, CONCERN_LEVEL } from "@/lib/status";
import { cn } from "@/lib/utils";

export default function CounselPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [annotation, setAnnotation] = useState<{ claimId: number; text: string; level: string } | null>(null);
  const [signOff, setSignOff] = useState({ open: false, notes: "", error: "" });

  const { data: view, isLoading } = useQuery<any>({
    queryKey: [`/api/counsel/matters/${id}`],
    queryFn: async () => {
      const r = await fetch(`/api/counsel/matters/${id}`, { credentials: "include" });
      return r.json();
    },
  });

  const annotateMutation = useMutation({
    mutationFn: async () => {
      if (!annotation) return;
      const r = await apiRequest("POST", `/api/counsel/matters/${id}/annotate-claim`, {
        claimId: annotation.claimId, annotation: annotation.text, concernLevel: annotation.level,
      });
      return r.json();
    },
    onSuccess: () => setAnnotation(null),
  });

  const readyToFileMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/counsel/matters/${id}/ready-to-file`, {
        signOffNotes: signOff.notes,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/counsel/matters/${id}`] });
      setSignOff({ open: false, notes: "", error: "" });
    },
    onError: (e: any) => setSignOff((s) => ({ ...s, error: e.message })),
  });

  if (isLoading) return <LoadingState />;
  const { matter, claims, disputes, ledgerIntegrity } = view ?? {};
  if (!matter) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <EmptyState icon={AlertTriangle} title="Matter not accessible" />
      </div>
    );
  }

  const acceptedClaims = (claims ?? []).filter((c: any) => c.status === "accepted");
  const openDisputes = (disputes ?? []).filter((d: any) => d.status === "open");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={<span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Step 5 · Counsel</span>}
        title={<span className="flex items-center gap-3"><Gavel className="h-7 w-7 text-gold" />Counsel Console</span>}
        description="Privileged attorney review of inventor-authored content. All access is timestamped and attributed to the provenance ledger."
      />

      <Alert variant="gold" className="mb-6">
        <Shield className="h-4 w-4" />
        <AlertTitle>ATTORNEY-CLIENT PRIVILEGED</AlertTitle>
        <AlertDescription>
          This console and all your interactions are logged to the Provenance Ledger for privilege documentation.
          Your annotations are &ldquo;For Counsel Review Only&rdquo; and do not modify inventor-authored content.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main review column */}
        <div className="space-y-6">
          {/* Matter card */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="mono">{matter.matterId}</Badge>
                <Badge variant="outline" className="capitalize">
                  {APPLICATION_TYPE[matter.applicationType] ?? matter.applicationType}
                </Badge>
              </div>
              <h2 className="mt-2 font-serif text-xl font-medium text-foreground">{matter.title}</h2>
              {matter.problemStatement && (
                <p className="mt-1 text-sm text-muted-foreground">{matter.problemStatement}</p>
              )}

              {openDisputes.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {openDisputes.length} open co-inventorship dispute{openDisputes.length === 1 ? "" : "s"} require
                    resolution before filing.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Claims review */}
          <section>
            <h3 className="mb-3 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">Claim Elements</span>
              <span className="text-xs text-muted-foreground">
                {(claims ?? []).length} total · {acceptedClaims.length} accepted
              </span>
            </h3>
            {acceptedClaims.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No accepted claims yet" description="Inventors must accept claim elements before counsel review." />
            ) : (
              <Accordion type="multiple">
                {acceptedClaims.map((claim: any) => (
                  <AccordionItem key={claim.id} value={`claim-${claim.id}`}>
                    <AccordionTrigger>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          #{claim.elementNumber}
                        </span>
                        <span className="truncate text-left text-foreground">
                          {(claim.humanFinalText ?? claim.aiProposedText ?? "").slice(0, 80)}…
                        </span>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          <StatusPill config={getClaimStatus(claim.status)} />
                          {claim.isPriorityGuardFlagged && (
                            <Badge variant="warning">PG flag</Badge>
                          )}
                          {claim.hasDispute && (
                            <Badge variant="destructive"><Flag className="h-3 w-3" />Dispute</Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-3 whitespace-pre-wrap text-sm leading-[1.7] text-foreground">
                        {claim.humanFinalText ?? claim.aiProposedText}
                      </p>
                      {claim.inventorAttestation && (
                        <p className="mb-4 rounded-md border border-border/60 bg-background/40 p-3 text-xs italic text-muted-foreground">
                          &ldquo;{claim.inventorAttestation}&rdquo;
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAnnotation({ claimId: claim.id, text: "", level: "none" })}
                        >
                          <MessageSquare /> Annotate
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </section>
        </div>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className={cn(ledgerIntegrity?.valid ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                {ledgerIntegrity?.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className={cn("text-xs font-medium", ledgerIntegrity?.valid ? "text-success" : "text-destructive")}>
                  Chain {ledgerIntegrity?.valid ? "intact" : "BROKEN"}
                </span>
              </div>
              <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                {ledgerIntegrity?.totalEntries ?? 0} ledger entries verified
              </p>
            </CardContent>
          </Card>

          {/* Sign-off */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-gold" />
                <span className="text-sm font-semibold text-foreground">Counsel Sign-Off</span>
              </div>
              <p className="mb-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
                Release this matter for filing. Irreversible — permanently logged with your identity and timestamp.
              </p>
              <Button
                className="w-full"
                onClick={() => setSignOff({ open: true, notes: "", error: "" })}
                disabled={openDisputes.length > 0}
              >
                <Lock /> Mark ready to file
              </Button>
              {openDisputes.length > 0 && (
                <p className="mt-2 text-[0.6875rem] text-destructive">
                  Resolve open disputes before signing off.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Annotate dialog */}
      <Dialog open={!!annotation} onOpenChange={(o) => !o && setAnnotation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annotate claim element</DialogTitle>
            <DialogDescription>Privileged — visible to counsel only.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={annotation?.level ?? "none"}
              onValueChange={(v) => setAnnotation((a) => (a ? { ...a, level: v } : null))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CONCERN_LEVEL).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={annotation?.text ?? ""}
              onChange={(e) => setAnnotation((a) => (a ? { ...a, text: e.target.value } : null))}
              placeholder="Counsel annotation (privileged)…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAnnotation(null)}>Cancel</Button>
            <Button
              onClick={() => annotateMutation.mutate()}
              disabled={!annotation?.text.trim() || annotateMutation.isPending}
            >
              {annotateMutation.isPending && <Loader2 className="animate-spin" />}
              Save annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign-off dialog */}
      <Dialog open={signOff.open} onOpenChange={(o) => setSignOff((s) => ({ ...s, open: o, error: "" }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark ready to file</DialogTitle>
            <DialogDescription>
              This action is irreversible and permanently logged to the Provenance Ledger.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={signOff.notes}
            onChange={(e) => setSignOff((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Sign-off notes (optional): caveats, conditions, or recommendations…"
            rows={4}
          />
          {signOff.error && (
            <Alert variant="destructive"><AlertDescription>{signOff.error}</AlertDescription></Alert>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignOff({ open: false, notes: "", error: "" })}>Cancel</Button>
            <Button
              variant="success"
              onClick={() => readyToFileMutation.mutate()}
              disabled={readyToFileMutation.isPending}
            >
              {readyToFileMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Confirm — ready to file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
