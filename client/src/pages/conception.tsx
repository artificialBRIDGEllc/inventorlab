import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { format } from "date-fns";
import {
  Lock, CheckCircle2, AlertTriangle, Loader2, Clock, Shield,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { ShaChip } from "@/components/app/sha-chip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ConceptionPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: cn } = useQuery<any>({
    queryKey: [`/api/matters/${id}/conception`],
    queryFn: async () => {
      const r = await fetch(`/api/matters/${id}/conception`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: matter } = useQuery<any>({
    queryKey: [`/api/matters/${id}`],
    queryFn: async () => {
      const r = await fetch(`/api/matters/${id}`, { credentials: "include" });
      return r.json();
    },
  });

  useEffect(() => {
    if (cn?.narrative && !text) setText(cn.narrative);
  }, [cn?.narrative]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/conception`, { narrative: text });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/matters/${id}/conception`] }),
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/conception/lock`, {});
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/matters/${id}/conception`] });
      qc.invalidateQueries({ queryKey: [`/api/matters/${id}`] });
    },
  });

  const openAiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/ai-session/open`, {});
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/matters/${id}`] }),
  });

  const isLocked = Boolean(cn?.isLocked);
  const wordCount = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={<span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Step 1 · Conception</span>}
        title="Conception Narrative"
        description="Document your invention in your own words — before any AI assistance. This narrative is timestamped with RFC 3161, FIDO2-signed, and permanently frozen when locked. It is the legal anchor of your inventorship record."
      />

      {!isLocked && (
        <Alert variant="gold" className="mb-5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>This session is isolated from AI assistance.</AlertTitle>
          <AlertDescription>
            Write what you conceived, in your own words, without consulting any AI tool.
            Once locked, this narrative cannot be modified. The lock triggers an RFC 3161 timestamp from an accredited TSA.
          </AlertDescription>
        </Alert>
      )}

      {isLocked ? (
        <Card className="locked-glow border-gold/30 bg-gold/[0.03]">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm font-semibold text-success">
                Conception locked — RFC 3161 anchored
              </span>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Locked {cn?.lockedAt ? format(new Date(cn.lockedAt), "PPp") : "–"}
              </span>
              <ShaChip label="sha256" value={cn?.sha256Hash} length={16} />
              {cn?.tsaSerial && <ShaChip label="TSA" value={cn.tsaSerial} length={12} />}
            </div>

            <div className="whitespace-pre-wrap rounded-md border border-border/60 bg-background/40 p-4 text-sm leading-[1.7] text-foreground/90">
              {cn?.narrative}
            </div>

            {matter?.sessionState === "conception_locked" && (
              <Button className="mt-5" onClick={() => openAiMutation.mutate()} disabled={openAiMutation.isPending}>
                {openAiMutation.isPending ? <Loader2 className="animate-spin" /> : <Shield />}
                Open AI session for claim drafting
              </Button>
            )}
            {matter?.sessionState === "ai_open" && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                AI session open — proceed to Claim Elements
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card/40 shadow-sm">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              placeholder={`Describe your invention in your own words.\n\nInclude:\n• When and how the idea came to you\n• What problem you identified\n• The core insight or solution you conceived\n• Any specific technical approaches you developed\n\nThis is your sworn statement of inventorship. Write it as if explaining to a judge.`}
              className="min-h-[420px] border-0 bg-transparent px-5 py-4 text-[0.9375rem] leading-[1.75] shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={!text.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="animate-spin" />}
              Save draft
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!text.trim() || lockMutation.isPending}>
                  {lockMutation.isPending ? <Loader2 className="animate-spin" /> : <Lock />}
                  Lock &amp; timestamp narrative
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Lock this conception narrative?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Locking is irreversible. It triggers an RFC 3161 TSA timestamp and permanently closes this session.
                    You will not be able to edit this narrative afterward.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => lockMutation.mutate()}>
                    Lock permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <span className="ml-auto text-[0.6875rem] text-muted-foreground">
              {wordCount} word{wordCount === 1 ? "" : "s"} · {text.length} chars
            </span>
          </div>
          {saveMutation.isSuccess && (
            <p className="mt-2 text-[0.6875rem] text-success">Draft saved.</p>
          )}
        </>
      )}
    </div>
  );
}
