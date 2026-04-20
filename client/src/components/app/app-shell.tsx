import * as React from "react";
import { Sidebar } from "./sidebar";
import { PrivilegeBanner } from "./privilege-banner";
import { MatterContextRail } from "./matter-context-rail";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen bg-background">
      <PrivilegeBanner />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pt-8">
        <MatterContextRail />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
