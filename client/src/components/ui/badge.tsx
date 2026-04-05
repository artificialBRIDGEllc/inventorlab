import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border border-transparent bg-primary/15 text-primary",
        secondary: "border border-border bg-secondary text-secondary-foreground",
        outline: "border border-border text-foreground",
        destructive: "border border-transparent bg-destructive/15 text-destructive",
        success: "border border-transparent bg-success/15 text-success",
        warning: "border border-transparent bg-warning/15 text-warning",
        info: "border border-transparent bg-info/15 text-info",
        gold: "border border-gold/30 bg-gold/10 text-gold",
        mono: "border border-border bg-accent text-muted-foreground font-mono",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
