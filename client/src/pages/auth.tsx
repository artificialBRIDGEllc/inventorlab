import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import { Shield, Lock, Loader2, FlaskConical } from "lucide-react";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, isLoginPending, isRegisterPending, loginError } = useAuth();
  const [mode, setMode]         = useState<"login"|"register">("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError]       = useState("");

  const handleSubmit = async () => {
    setError("");
    try {
      if (mode === "login") { await login({ email, password }); }
      else                  { await register({ email, password, fullName }); }
      navigate("/");
    } catch (e: any) { setError(e.message); }
  };

  const isPending = isLoginPending || isRegisterPending;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#030407", backgroundImage: "linear-gradient(rgba(229,192,123,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(229,192,123,0.03) 1px,transparent 1px)", backgroundSize: "50px 50px" }}>
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <FlaskConical className="w-8 h-8" style={{ color: "#E5C07B" }} />
          <span className="text-2xl font-bold text-white">InventorLab</span>
        </div>
        <p className="text-sm" style={{ color: "#6b7280" }}>Litigation-grade invention capture platform</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="p-6 rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 mb-5 p-2.5 rounded-lg" style={{ background: "rgba(229,192,123,0.06)", border: "1px solid rgba(229,192,123,0.15)" }}>
            <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: "#E5C07B" }} />
            <p className="text-xs" style={{ color: "#E5C07B" }}>Attorney-Client Privileged Environment — Enterprise DPA Active</p>
          </div>

          {mode === "register" && (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1" style={{ color: "#9ca3af" }}>Full legal name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="As it will appear on patent applications"
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
          )}
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: "#9ca3af" }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          </div>
          <div className="mb-5">
            <label className="block text-xs font-medium mb-1" style={{ color: "#9ca3af" }}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          </div>

          {error && <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>{error}</div>}

          <button onClick={handleSubmit} disabled={isPending || !email || !password}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "#E5C07B", color: "#030407", opacity: (isPending || !email || !password) ? 0.5 : 1 }}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {mode === "login" ? "Sign in securely" : "Create account"}
          </button>
        </div>
        <p className="text-center text-sm mt-4" style={{ color: "#6b7280" }}>
          {mode === "login" ? "New to InventorLab? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ color: "#E5C07B" }}>
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
