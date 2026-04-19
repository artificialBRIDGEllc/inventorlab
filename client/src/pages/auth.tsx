import { useState } from "react";
import { useLocation } from "wouter";
import { FlaskConical, Shield, Lock, Fingerprint, FileCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, isLoginPending, isRegisterPending } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const isPending = isLoginPending || isRegisterPending;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    try {
      if (mode === "login") await login({ email, password });
      else await register({ email, password, fullName });
      navigate("/");
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed");
    }
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-border bg-card/30 p-10 grid-bg">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gold/15 text-gold">
            <FlaskConical className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">InventorLab</span>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-gold">
            Litigation-grade capture
          </p>
          <h1 className="font-serif text-4xl font-medium leading-[1.1] tracking-tight text-foreground text-balance">
            Evidence-grade invention capture.
            <br />
            <span className="text-muted-foreground">From conception to counsel.</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
            Every narrative timestamped. Every claim attributed. Every action chain-hashed and TSA-anchored.
            Built for inventors and the attorneys who defend their priority.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3 border-t border-border/60 pt-6">
          {[
            { icon: Shield, label: "RFC 3161 TSA" },
            { icon: Fingerprint, label: "FIDO2 signing" },
            { icon: FileCheck, label: "Enterprise DPA" },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <t.icon className="h-3.5 w-3.5 text-gold" />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gold/15 text-gold">
              <FlaskConical className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold text-foreground">InventorLab</span>
          </div>

          <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to your attorney-client privileged workspace."
              : "Your legal name will appear on every patent application."}
          </p>

          <Alert variant="gold" className="mt-6">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Attorney-Client Privileged Environment — Enterprise DPA Active
            </AlertDescription>
          </Alert>

          <Tabs value={mode} onValueChange={(v) => { setMode(v as "login" | "register"); setError(""); }} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full legal name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As it will appear on patent applications"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isPending || !email || !password || (mode === "register" && !fullName)}>
                {isPending ? <Loader2 className="animate-spin" /> : <Lock />}
                {mode === "login" ? "Sign in securely" : "Create account"}
              </Button>
            </form>
          </Tabs>

          <p className="mt-8 text-center text-[0.6875rem] text-muted-foreground/70">
            By continuing you agree to InventorLab&rsquo;s attorney-client privileged terms.
          </p>
        </div>
      </div>
    </div>
  );
}
