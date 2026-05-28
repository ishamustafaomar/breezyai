import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BreezyLogo } from "@/components/breezy-logo";

export function SiteHeader() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <BreezyLogo className="size-9 group-hover:rotate-6 transition-transform" />
          <span className="font-display text-xl font-bold tracking-tight">breezy</span>
        </Link>


        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <Link to="/pricing" className="px-3 py-2 rounded-lg hover:bg-muted transition-colors" activeProps={{ className: "text-primary" }}>
            Pricing
          </Link>
          <a href="#features" className="px-3 py-2 rounded-lg hover:bg-muted transition-colors">
            Features
          </a>
          <a href="#how" className="px-3 py-2 rounded-lg hover:bg-muted transition-colors">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground max-w-[160px] truncate">
                {user.email}
              </span>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-ink text-cream hover:bg-ink/90 transition-all hover:scale-[1.03] shadow-soft"
              >
                Open builder
                <Sparkles className="size-3.5" />
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="hidden sm:inline-flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted transition-colors">
                Sign in
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full bg-ink text-cream hover:bg-ink/90 transition-all hover:scale-[1.03] shadow-soft"
              >
                Start building
                <Sparkles className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
