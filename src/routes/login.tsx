import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BreezyLogo } from "@/components/breezy-logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

function safeRedirect(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//") || value.startsWith("/~oauth")) return "/dashboard";
  return value;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: safeRedirect(s.redirect),
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Breezy" },
      { name: "description", content: "Sign in or create your Breezy account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // navigate unused — we use a hard redirect to avoid auth race conditions.
  const search = Route.useSearch();
  const redirectTo = safeRedirect(search.redirect);
  const navigated = useRef(false);

  const goToApp = () => {
    if (navigated.current) return;
    navigated.current = true;
    // Hard navigation guarantees the new session is picked up everywhere
    // (avoids race where _authenticated bounces back to /login).
    window.location.replace(redirectTo);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) goToApp();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goToApp();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to Breezy!");
          goToApp();
        } else {
          // Shouldn't happen with auto-confirm on, but fall back gracefully.
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
          goToApp();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        goToApp();
      }
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-gradient-to-b from-background to-muted/40">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8 group">
          <BreezyLogo className="size-10 group-hover:rotate-6 transition-transform" />
          <span className="font-display text-2xl font-bold tracking-tight">breezy</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card shadow-soft p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-center">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {mode === "signin" ? "Sign in to keep building." : "Start vibe-coding in seconds."}
          </p>

          <form onSubmit={handleEmail} className="mt-6 space-y-3">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin + redirectTo,
                });
                if (result.error) throw result.error;
                if (!result.redirected) goToApp();
              } catch (err) {
                toast.error((err as Error).message || "Google sign-in failed");
                setBusy(false);
              }
            }}
            className="w-full gap-2"
          >
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
              <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
            </svg>
            Continue with Google
          </Button>


          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button onClick={() => setMode("signup")} className="text-foreground font-medium hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => setMode("signin")} className="text-foreground font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
