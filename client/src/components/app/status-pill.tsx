import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { StatusConfig } from "@/lib/status";

export function StatusPill({
  config,
  showDot = true,
  className,
}: {
  config: StatusConfig;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={config.variant} className={cn("font-medium", className)}>
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} aria-hidden />
      )}
      {config.label}
    </Badge>
  );
}
