import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ShaChip({
  value,
  label,
  length = 12,
  className,
}: {
  value: string | null | undefined;
  label?: string;
  length?: number;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  if (!value) return null;
  const truncated = value.length > length ? `${value.slice(0, length)}…` : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-md border border-border bg-accent/40 px-2 py-0.5 font-mono text-[0.6875rem] text-muted-foreground transition-colors hover:text-foreground hover:border-border/80",
            className
          )}
        >
          {label && <span className="text-muted-foreground/70">{label}:</span>}
          <span className="text-foreground/80">{truncated}</span>
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="font-mono text-[0.6875rem]">{value}</TooltipContent>
    </Tooltip>
  );
}
