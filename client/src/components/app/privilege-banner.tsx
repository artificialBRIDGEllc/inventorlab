import { Shield } from "lucide-react";

export function PrivilegeBanner() {
  return (
    <div className="privilege-pulse fixed top-0 left-0 right-0 z-40 flex items-center justify-center gap-2 border-b border-gold/20 bg-card/95 py-1.5 text-[0.6875rem] font-medium text-gold backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <Shield className="h-3 w-3" />
      <span className="tracking-wide">
        ATTORNEY-CLIENT PRIVILEGED — All AI outputs marked &ldquo;For Counsel Review Only&rdquo; — InventorLab Enterprise DPA Active
      </span>
    </div>
  );
}
