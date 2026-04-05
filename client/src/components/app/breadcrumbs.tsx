import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {items.map((c, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={`${c.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
            {c.href && !isLast ? (
              <Link href={c.href} className="transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={cn(isLast && "text-foreground font-medium")}>{c.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
