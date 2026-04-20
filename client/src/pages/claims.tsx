import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Brain, Loader2, CheckCircle2, XCircle, Edit3, AlertTriangle, Plus, Flag,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { LoadingState } from "@/components/app/loading-state";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getClaimStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

type ClaimElement = {
  id: number;
  elementNumber: number;
  aiProposedText: string | null;
  humanFinalText: string | null;
  status: string;
  hasDispute: boolean;
  attestedAt: string | null;
};

export default function ClaimsPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [instruction, setInstruction] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [attestation, setAttestation] = useState("");
  const [dispute, setDispute] = useState<{ id: number; basis: string } | null>(null);
  const [error, setError] = useState("");

  const { data: matter } = useQuery<any>({
    queryKey: [`/api/matters/${id}`],
    queryFn: async () => {
      const r = await fetch(`/api/matters/${id}`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: claims = [], isLoading } = useQuery<ClaimElement[]>({
    queryKey: [`/api/matters/${id}/claims`],
    queryFn: async () => {
      const r = await fetch(`/api/matters/${id}/claims`, { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    },
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/claims/draft`, {
        instruction: instruction || undefined,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/matters/${id}/claims`] });
      setInstruction(""); setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const actionMutation = useMutation({
    mutationFn: async (v: { elementId: number; action: string; humanFinalText?: string; att?: string }) => {
      const r = await apiRequest("PATCH", `/api/matters/${id}/claims/${v.elementId}`, {
        action: v.action,
        humanFinalText: v.humanFinalText ?? null,
        attestation: v.att ?? null,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/matters/${id}/claims`] });
      setEditingId(null); setAttestation("");
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async () => {
      if (!dispute) return;
      const r = await apiRequest("POST", `/api/matters/${id}/disputes`, {
        claimElementId: dispute.id,
        basis: dispute.basis,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/matters/${id}/claims`] });
      setDispute(null);
    },
  });

  const aiDisabled = matter?.hasFederalFunding;
  const aiOpen = matter?.sessionState === "ai_open" || matter?.sessionState === "ai_locked";
  const acceptedCount = claims.filter((c) => c.status === "accepted").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={<span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Step 2 · Claims</span>}
        title="Claim Elements"
        description="AI proposes — you decide. Every accepted element is timestamped and attested. DRAFT — For Counsel Review Only."
        actions={
          <Badge variant="gold">
            {acceptedCount} accepted · {claims.length} total
          </Badge>
        }
      />

      {aiDisabled && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Bayh-Dole restriction active</AlertTitle>
          <AlertDescription>
            AI-assisted drafting is disabled for federally-funded matters. Add claim elements manually below.
          </AlertDescription>
        </Alert>
      )}

      {!aiDisabled && aiOpen && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <Label htmlFor="instruction" className="mb-2 block">
              Instruction (optional — describe what element to draft)
            </Label>
            <div className="flex gap-2">
              <Input
                id="instruction"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. Draft the independent method claim for the decay function…"
                onKeyDown={(e) => e.key === "Enter" && draftMutation.mutate()}
                className="flex-1"
              />
              <Button onClick={() => draftMutation.mutate()} disabled={draftMutation.isPending}>
                {draftMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                Draft
              </Button>
            </div>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : claims.length === 0 ? (
        <EmptyState
          icon={Brain}
          title={aiOpen ? "No claim elements yet" : "Waiting on conception lock"}
          description={aiOpen ? "Draft your first claim element above." : "Lock your conception narrative first to enable claim drafting."}
        />
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => {
            const statusCfg = getClaimStatus(claim.status);
            const isEditing = editingId === claim.id;
            return (
              <Card key={claim.id} className="overflow-hidden">
                <div className="flex">
                  <div
                    className={cn(
                      "w-0.5 shrink-0",
                      claim.status === "accepted" && "bg-success",
                      claim.status === "proposed" && "bg-gold",
                      claim.status === "rejected" && "bg-destructive",
                      claim.status === "modified" && "bg-info"
                    )}
                  />
                  <CardContent className="flex-1 p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          #{claim.elementNumber}
                        </span>
                        <StatusPill config={statusCfg} />
                        {claim.hasDispute && (
                          <Badge variant="destructive"><Flag className="h-3 w-3" />Disputed</Badge>
                        )}
                      </div>
                      {claim.attestedAt && (
                        <span className="text-[0.6875rem] text-muted-foreground">
                          Attested {new Date(claim.attestedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={5}
                          className="border-gold/30"
                        />
                        <Input
                          value={attestation}
                          onChange={(e) => setAttestation(e.target.value)}
                          placeholder="Attestation: I conceived this element independently…"
                          className="text-xs"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => actionMutation.mutate({
                              elementId: claim.id, action: "accept",
                              humanFinalText: editText, att: attestation,
                            })}
                            disabled={!editText.trim() || !attestation.trim() || actionMutation.isPending}
                          >
                            <CheckCircle2 /> Accept &amp; attest
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => actionMutation.mutate({
                              elementId: claim.id, action: "modify",
                              humanFinalText: editText, att: attestation,
                            })}
                            disabled={!editText.trim() || actionMutation.isPending}
                          >
                            <Edit3 /> Save modified
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => actionMutation.mutate({ elementId: claim.id, action: "reject" })}
                          >
                            <XCircle /> Reject
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={cn(
                            "whitespace-pre-wrap rounded-md border border-border/60 bg-background/40 p-4 leading-[1.7] text-foreground/90",
                            claim.status === "accepted" ? "text-sm font-sans" : "text-xs font-mono"
                          )}
                        >
                          {claim.humanFinalText ?? claim.aiProposedText}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {claim.status === "proposed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditingId(claim.id); setEditText(claim.aiProposedText ?? ""); }}
                              className="border-gold/30 text-gold hover:bg-gold/10"
                            >
                              <Edit3 /> Review &amp; act
                            </Button>
                          )}
                          {claim.status === "accepted" && !claim.hasDispute && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDispute({ id: claim.id, basis: "" })}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Flag /> Flag attribution dispute
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dispute dialog */}
      <Dialog open={!!dispute} onOpenChange={(open) => !open && setDispute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Log co-inventorship attribution dispute</DialogTitle>
            <DialogDescription>
              Submitting a dispute notifies counsel within 15 minutes and is permanently logged to the provenance ledger.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={dispute?.basis ?? ""}
            onChange={(e) => setDispute((d) => (d ? { ...d, basis: e.target.value } : null))}
            rows={4}
            placeholder="State your basis for this dispute in good faith…"
            className="border-destructive/30"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDispute(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => disputeMutation.mutate()}
              disabled={!dispute?.basis.trim() || disputeMutation.isPending}
            >
              {disputeMutation.isPending && <Loader2 className="animate-spin" />}
              Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
