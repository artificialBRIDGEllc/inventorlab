import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8", className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <div className="flex items-center gap-2">{eyebrow}</div>}
        <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground text-balance">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed text-pretty">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
