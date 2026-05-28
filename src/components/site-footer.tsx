import { Link } from "@tanstack/react-router";
import { BreezyLogo } from "@/components/breezy-logo";

export function SiteFooter() {
  return (
    <footer className="relative mt-32 border-t border-border/60 bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-7xl px-5 py-16 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2">
            <BreezyLogo className="size-10" />
            <span className="font-display text-2xl font-bold">breezy</span>
          </Link>

          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            The friendliest way to vibe-code beautiful apps. Speak it, see it, ship it.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold mb-3">Product</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/dashboard" className="hover:text-foreground">Builder</Link></li>
            
            <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><a href="#features" className="hover:text-foreground">Features</a></li>
          </ul>
        </div>

      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-5 py-6 text-xs text-muted-foreground text-center">
          © 2026 Breezy. Made with sunshine.
        </div>
      </div>
    </footer>
  );
}
