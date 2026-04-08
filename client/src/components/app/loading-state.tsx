import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-muted-foreground", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-gold" />
      {label && <p className="mt-3 text-xs">{label}</p>}
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-3.5 w-3.5 animate-spin", className)} />;
}
