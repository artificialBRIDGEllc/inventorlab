import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { format } from "date-fns";
import {
  FileText, Loader2, CheckCircle2, AlertTriangle, Shield,
  ExternalLink, Zap,
} from "lucide-react";
import { apiRequest, fetchJson } from "@/lib/api";
import { PageHeader } from "@/components/app/page-header";
import { LoadingState } from "@/components/app/loading-state";
import { StatusPill } from "@/components/app/status-pill";
import { ShaChip } from "@/components/app/sha-chip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { getPgStatus } from "@/lib/status";

type RecordData = {
  matter: any;
  inventors: any[];
  conception: any | null;
  claims: any[];
  priorArt: any[];
  ledgerSummary: {
    totalEntries: number;
    aiCallCount: number;
    humanActionCount: number;
    lastChainHash: string | null;
    lastTsaSerial: string | null;
  };
  generatedAt: string;
  recordHash: string;
  tsaSerial: string | null;
  disclaimer: string;
};

type PriorityGuard = {
  overallStatus: string;
  recommendation: string;
  uncoveredClaims: any[];
  cipNewMatterItems: any[];
  coveredByParent: number;
  totalCurrentClaims: number;
};

export default function InventionRecordPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<"record" | "priority-guard">("record");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/matters/${id}/invention-record/generate`, {});
      return r.json() as Promise<RecordData>;
    },
  });

  const { data: pg, isLoading: pgLoading } = useQuery<PriorityGuard>({
    queryKey: [`/api/matters/${id}/priority-guard`],
    queryFn: () => fetchJson<PriorityGuard>(`/api/matters/${id}/priority-guard`),
    enabled: tab === "priority-guard",
  });

  const record = generateMutation.data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <PageHeader
        eyebrow={<span className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">Step 4 · Record</span>}
        title="Invention Record"
        description="RFC 3161-anchored summary document. Generate, review, then send to counsel for sign-off."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-6">
        <TabsList>
          <TabsTrigger value="record">Invention Record</TabsTrigger>
          <TabsTrigger value="priority-guard">Priority Guard</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="mt-6">
          <Alert variant="warning" className="mb-5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>DRAFT — For Counsel Review Only</AlertTitle>
            <AlertDescription>
              Not a legal opinion. All outputs require independent attorney review before use in patent prosecution.
            </AlertDescription>
          </Alert>

          {!record ? (
            <Card className="paper-surface">
              <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-xl font-medium text-foreground">Generate Invention Record</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed text-pretty">
                  Compiles your conception narrative, accepted claim elements, prior art summary,
                  and full provenance ledger into a RFC 3161-anchored document.
                </p>
                <Button
                  size="lg"
                  className="mt-6"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? <Loader2 className="animate-spin" /> : <Zap />}
                  {generateMutation.isPending ? "Generating…" : "Generate record"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              {/* Main document */}
              <Card>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-semibold text-foreground">Invention Record generated</span>
                    {record.tsaSerial && <Badge variant="success">RFC 3161 TSA ✓</Badge>}
                  </div>

                  <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatBox label="Inventors" value={record.inventors.length} />
                    <StatBox label="Claims" value={record.claims.length} />
                    <StatBox label="Prior art" value={record.priorArt.length} />
                    <StatBox label="Ledger entries" value={record.ledgerSummary.totalEntries} />
                  </div>

                  <dl className="space-y-2 text-[0.6875rem]">
                    <Row label="Record hash" value={<ShaChip value={record.recordHash} length={24} />} />
                    {record.tsaSerial && (
                      <Row label="TSA serial" value={<ShaChip value={record.tsaSerial} length={24} />} />
                    )}
                    <Row
                      label="Last chain hash"
                      value={<ShaChip value={record.ledgerSummary.lastChainHash ?? undefined} length={24} />}
                    />
                    <Row
                      label="Generated"
                      value={<span className="text-foreground/80">{format(new Date(record.generatedAt), "PPp")}</span>}
                    />
                  </dl>
                </CardContent>
              </Card>

              {/* Action rail */}
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => window.open(`/api/matters/${id}/invention-record/html`, "_blank")}
                >
                  <ExternalLink /> View / Print to PDF
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending && <Loader2 className="animate-spin" />}
                  Regenerate
                </Button>

                <Card className="bg-card/40">
                  <CardContent className="p-4">
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                      Ledger summary
                    </p>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">AI calls</dt>
                        <dd className="font-mono tabular-nums text-foreground">{record.ledgerSummary.aiCallCount}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Human actions</dt>
                        <dd className="font-mono tabular-nums text-foreground">{record.ledgerSummary.humanActionCount}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                  To produce the final signed PDF: open the record, review all sections, then use your browser&rsquo;s
                  print function (⌘/Ctrl+P) → &ldquo;Save as PDF&rdquo;.
                </p>
              </div>
            </div>
          )}

          {generateMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{(generateMutation.error as Error).message}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="priority-guard" className="mt-6">
          {pgLoading ? (
            <LoadingState />
          ) : pg ? (
            <div className="space-y-4">
              <Alert
                variant={
                  pg.overallStatus === "CLEAR"
                    ? "success"
                    : pg.overallStatus === "GAP_DETECTED"
                    ? "destructive"
                    : pg.overallStatus === "CIP_NEW_MATTER"
                    ? "gold"
                    : "default"
                }
              >
                <Shield className="h-4 w-4" />
                <AlertTitle className="capitalize">
                  Priority Guard · {pg.overallStatus.replace(/_/g, " ").toLowerCase()}
                </AlertTitle>
                <AlertDescription>{pg.recommendation}</AlertDescription>
              </Alert>

              {pg.totalCurrentClaims > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Parent coverage</span>
                      <StatusPill config={getPgStatus(pg.overallStatus)} />
                    </div>
                    <Progress
                      value={(pg.coveredByParent / pg.totalCurrentClaims) * 100}
                      indicatorClassName={pg.uncoveredClaims.length > 0 ? "bg-destructive" : "bg-success"}
                    />
                    <p className="mt-2 text-[0.6875rem] text-muted-foreground">
                      {pg.coveredByParent} / {pg.totalCurrentClaims} claims covered
                    </p>
                  </CardContent>
                </Card>
              )}

              {pg.uncoveredClaims.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Priority Date Gaps ({pg.uncoveredClaims.length})
                  </h3>
                  <Accordion type="multiple">
                    {pg.uncoveredClaims.map((gap: any, i: number) => (
                      <AccordionItem key={i} value={`gap-${i}`} className="border-destructive/20 bg-destructive/5">
                        <AccordionTrigger className="text-destructive">
                          <span>Claim Element #{gap.elementNumber}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="mb-2 text-sm text-foreground">{gap.claimText}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{gap.explanation}</p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {pg.cipNewMatterItems.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 text-gold" />
                    CIP New Matter ({pg.cipNewMatterItems.length})
                  </h3>
                  <Accordion type="multiple">
                    {pg.cipNewMatterItems.map((item: any, i: number) => (
                      <AccordionItem key={i} value={`cip-${i}`} className="border-gold/20 bg-gold/5">
                        <AccordionTrigger className="text-gold">
                          <span>Claim Element #{item.elementNumber} — CIP new matter</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="mb-2 text-sm text-foreground">{item.claimText}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.explanation}</p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-3 text-center">
      <div className="font-serif text-2xl font-medium tabular-nums text-foreground">{value}</div>
      <div className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
