import { Link, useRoute, useLocation } from "wouter";
import {
  BookOpen, Brain, Search, FileText, Gavel, Lock, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  slug: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: Step[] = [
  { slug: "",                  label: "Overview",         icon: Home },
  { slug: "conception",        label: "Conception",       icon: BookOpen },
  { slug: "claims",            label: "Claims",           icon: Brain },
  { slug: "prior-art",         label: "Prior Art",        icon: Search },
  { slug: "invention-record",  label: "Record",           icon: FileText },
  { slug: "counsel",           label: "Counsel",          icon: Gavel },
  { slug: "ledger",            label: "Ledger",           icon: Lock },
];

export function MatterContextRail() {
  const [matchParent, paramsParent] = useRoute("/matters/:id");
  const [matchChild, paramsChild]   = useRoute("/matters/:id/:section*");
  const [location] = useLocation();

  const id = paramsChild?.id ?? paramsParent?.id;
  if (!id) return null;
  if (!matchParent && !matchChild) return null;

  const activeSlug = (() => {
    // /matters/:id          → ""
    // /matters/:id/<slug>   → "<slug>"
    const parts = location.split("/").filter(Boolean);
    // ["matters", id, maybeSlug]
    return parts[2] ?? "";
  })();

  return (
    <div className="border-b border-border bg-card/20">
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = step.slug === activeSlug;
          const href = step.slug ? `/matters/${id}/${step.slug}` : `/matters/${id}`;
          return (
            <Link
              key={step.slug || "overview"}
              href={href}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 px-3 py-3 text-xs font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {step.label}
              <span
                className={cn(
                  "absolute inset-x-3 -bottom-px h-px bg-gold transition-opacity",
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30"
                )}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
