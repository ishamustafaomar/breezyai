import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Check, Sparkles, Rocket, Building2 } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Breezy" },
      { name: "description", content: "Simple, friendly pricing. Free to start, pay when you ship." },
      { property: "og:title", content: "Pricing — Breezy" },
      { property: "og:description", content: "Free to start. Pay only when you publish." },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "Free",
    tag: "Just vibing",
    price: "$0",
    note: "forever",
    icon: Sparkles,
    tint: "bg-gradient-fresh",
    features: [
      "Unlimited prototypes",
      "Live preview & sharing",
      "Community templates",
      "Up to 3 active projects",
    ],
    cta: "Start for free",
  },
  {
    name: "Pro",
    tag: "Most loved",
    price: "$19",
    note: "/month",
    icon: Rocket,
    tint: "bg-gradient-warm",
    featured: true,
    features: [
      "Everything in Free",
      "Unlimited projects & seats",
      "Custom domains + SSL",
      "Built-in database & auth",
      "Priority generation queue",
      "Real-time collaboration",
    ],
    cta: "Go Pro",
  },
  {
    name: "Team",
    tag: "Ship together",
    price: "$49",
    note: "/seat / month",
    icon: Building2,
    tint: "bg-gradient-cool",
    features: [
      "Everything in Pro",
      "Roles & permissions",
      "SSO (Google, Okta)",
      "Audit logs",
      "Dedicated support",
    ],
    cta: "Talk to us",
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero opacity-70" />
          <div className="relative mx-auto max-w-5xl px-5 pt-20 pb-12 text-center">
            <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Pricing</p>
            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight">
              Honest pricing.<br />
              <span className="text-muted-foreground">Generous free tier.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
              Build forever for free. Upgrade only when you're ready to ship to the world.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-3xl p-7 border shadow-card flex flex-col ${
                  p.featured
                    ? "bg-card border-primary/40 ring-2 ring-primary/30 md:scale-[1.03]"
                    : "bg-card border-border"
                }`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1 rounded-full bg-ink text-cream">
                    {p.tag.toUpperCase()}
                  </span>
                )}
                <div className={`size-12 rounded-2xl ${p.tint} grid place-items-center shadow-soft mb-4`}>
                  <p.icon className="size-5 text-ink" strokeWidth={2.25} />
                </div>
                <h3 className="font-display text-2xl font-bold">{p.name}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">{p.tag}</p>
                <div className="flex items-baseline gap-1.5 mb-5">
                  <span className="font-display text-5xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.note}</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm">
                      <div className="shrink-0 size-5 rounded-full bg-mint grid place-items-center mt-0.5">
                        <Check className="size-3 text-ink" strokeWidth={3} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard"
                  className={`text-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                    p.featured
                      ? "bg-ink text-cream hover:scale-[1.02] shadow-glow"
                      : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-16 max-w-3xl mx-auto rounded-3xl bg-card border border-border p-7 shadow-soft">
            <h3 className="font-display text-2xl font-bold mb-5">Frequently asked</h3>
            <div className="divide-y divide-border">
              {[
                ["Is there really a free tier?", "Yes. You can build unlimited prototypes for free, forever. We only charge when you publish to a custom domain or use Pro features."],
                ["Do I own the code?", "100%. Every project exports clean TypeScript + React you can take anywhere — no lock-in."],
                ["Can I cancel anytime?", "Of course. One click, no calls, no guilt-trips."],
                ["Do you offer student discounts?", "Yes — 50% off Pro for students and educators. Just email us."],
              ].map(([q, a]) => (
                <details key={q} className="py-4 group">
                  <summary className="cursor-pointer font-semibold flex items-center justify-between list-none">
                    {q}
                    <span className="text-primary group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
