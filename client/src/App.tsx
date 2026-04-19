import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/app/app-shell";
import { LoadingState } from "@/components/app/loading-state";
import { useAuth } from "@/lib/auth";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import MatterPage from "@/pages/matter";
import ConceptionPage from "@/pages/conception";
import ClaimsPage from "@/pages/claims";
import LedgerPage from "@/pages/ledger";
import PriorArtPage from "@/pages/prior-art";
import InventionRecordPage from "@/pages/invention-record";
import CounselPage from "@/pages/counsel";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoggedIn, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate("/auth");
    }
  }, [isLoggedIn, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }
  if (!isLoggedIn) {
    return null;
  }
  return <Component />;
}

export default function App() {
  const { isLoggedIn, isLoading } = useAuth();
  const [location] = useLocation();
  const isAuth = location === "/auth";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      {isLoggedIn && !isAuth ? (
        <AppShell>
          <Switch>
            <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
            <Route path="/matters/:id" component={() => <ProtectedRoute component={MatterPage} />} />
            <Route path="/matters/:id/conception" component={() => <ProtectedRoute component={ConceptionPage} />} />
            <Route path="/matters/:id/claims" component={() => <ProtectedRoute component={ClaimsPage} />} />
            <Route path="/matters/:id/ledger" component={() => <ProtectedRoute component={LedgerPage} />} />
            <Route path="/matters/:id/prior-art" component={() => <ProtectedRoute component={PriorArtPage} />} />
            <Route path="/matters/:id/invention-record" component={() => <ProtectedRoute component={InventionRecordPage} />} />
            <Route path="/matters/:id/counsel" component={() => <ProtectedRoute component={CounselPage} />} />
            <Route><NotFound /></Route>
          </Switch>
        </AppShell>
      ) : (
        <Switch>
          <Route path="/auth" component={AuthPage} />
          <Route component={AuthPage} />
        </Switch>
      )}
      <Toaster />
    </TooltipProvider>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <p className="font-serif text-2xl text-foreground">Page not found</p>
      <p className="mt-2 text-sm text-muted-foreground">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
    </div>
  );
}
