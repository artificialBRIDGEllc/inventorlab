import { Switch, Route, useLocation } from "wouter";
import { useAuth } from "./lib/auth";
import AuthPage from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import MatterPage from "./pages/matter";
import ConceptionPage from "./pages/conception";
import ClaimsPage from "./pages/claims";
import LedgerPage from "./pages/ledger";
import PriorArtPage from "./pages/prior-art";
import InventionRecordPage from "./pages/invention-record";
import CounselPage from "./pages/counsel";
import { Shield, Loader2 } from "lucide-react";

function PrivilegeBanner() {
  return (
    <div className="privilege-banner fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1.5 text-xs"
      style={{ background: "rgba(10,13,20,0.95)", borderBottom: "1px solid rgba(229,192,123,0.2)", color: "#E5C07B" }}>
      <Shield className="w-3 h-3" />
      ATTORNEY-CLIENT PRIVILEGED — All AI outputs marked "For Counsel Review Only" — InventorLab Enterprise DPA Active
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isLoggedIn, isLoading } = useAuth();
  const [, navigate] = useLocation();
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#E5C07B" }} />
    </div>
  );
  if (!isLoggedIn) { navigate("/auth"); return null; }
  return <Component />;
}

export default function App() {
  const { isLoggedIn } = useAuth();
  return (
    <>
      {isLoggedIn && <PrivilegeBanner />}
      <div style={{ paddingTop: isLoggedIn ? "32px" : "0" }}>
        <Switch>
          <Route path="/auth"                    component={AuthPage} />
          <Route path="/"                        component={() => <ProtectedRoute component={DashboardPage} />} />
          <Route path="/matters/:id"             component={() => <ProtectedRoute component={MatterPage} />} />
          <Route path="/matters/:id/conception"  component={() => <ProtectedRoute component={ConceptionPage} />} />
          <Route path="/matters/:id/claims"      component={() => <ProtectedRoute component={ClaimsPage} />} />
          <Route path="/matters/:id/ledger"      component={() => <ProtectedRoute component={LedgerPage} />} />
          <Route path="/matters/:id/prior-art"        component={() => <ProtectedRoute component={PriorArtPage} />} />
          <Route path="/matters/:id/invention-record" component={() => <ProtectedRoute component={InventionRecordPage} />} />
          <Route path="/matters/:id/counsel"          component={() => <ProtectedRoute component={CounselPage} />} />
        </Switch>
      </div>
    </>
  );
}
