import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArrowUpRight, Heart } from "lucide-react";

export const Route = createFileRoute("/showcase")({
  head: () => ({
    meta: [
      { title: "Showcase — Apps built with Breezy" },
      { name: "description", content: "A gallery of apps built and shipped with Breezy. Get inspired." },
      { property: "og:title", content: "Showcase — Built with Breezy" },
      { property: "og:description", content: "A gallery of apps built and shipped with Breezy." },
    ],
  }),
  component: ShowcasePage,
});

const PROJECTS = [
  { title: "Sunday Recipes", tag: "Food & Cooking", maker: "Maya R.", color: "bg-gradient-warm", likes: 1234 },
  { title: "Stoic Daily", tag: "Journaling", maker: "Diego P.", color: "bg-gradient-cool", likes: 982 },
  { title: "Sprout", tag: "Plant Care", maker: "Sasha K.", color: "bg-gradient-fresh", likes: 766 },
  { title: "Loop Fitness", tag: "Workouts", maker: "Theo L.", color: "bg-gradient-rainbow", likes: 2104 },
  { title: "Tidepool", tag: "Habit Tracker", maker: "Ana M.", color: "bg-gradient-cool", likes: 540 },
  { title: "Lumen Pages", tag: "Portfolio Builder", maker: "Jin H.", color: "bg-gradient-warm", likes: 1890 },
  { title: "Bonfire", tag: "Community Forum", maker: "Riya S.", color: "bg-gradient-fresh", likes: 612 },
  { title: "Pocket Pantry", tag: "Grocery Lists", maker: "Otto W.", color: "bg-gradient-rainbow", likes: 423 },
  { title: "Studio Brief", tag: "Client Portal", maker: "Nia C.", color: "bg-gradient-warm", likes: 1011 },
];

const TAGS = ["All", "Food & Cooking", "Journaling", "Habit Tracker", "Portfolio Builder", "Community Forum", "Workouts"];

function ShowcasePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative">
          <div className="absolute inset-0 bg-gradient-hero opacity-60" />
          <div className="relative mx-auto max-w-7xl px-5 pt-20 pb-12 text-center">
            <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Showcase</p>
            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
              A gallery of <span className="bg-gradient-warm bg-clip-text text-transparent">good ideas</span>,<br />
              shipped quickly.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
              Real apps built by real people on Breezy. Steal an idea — or remix one of these in a click.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {TAGS.map((t, i) => (
                <button
                  key={t}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    i === 0
                      ? "bg-ink text-cream"
                      : "bg-card border border-border hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROJECTS.map((p, i) => (
              <Link
                to="/app"
                key={p.title}
                className="group rounded-3xl bg-card border border-border shadow-soft overflow-hidden hover:shadow-card hover:-translate-y-1 transition-all"
              >
                <div className={`relative aspect-[4/3] ${p.color} overflow-hidden`}>
                  <div className="absolute inset-0 grain" />
                  <div
                    className="absolute inset-x-6 top-8 bottom-12 rounded-2xl bg-card/90 backdrop-blur p-3 shadow-soft flex flex-col gap-1.5 group-hover:scale-[1.02] transition-transform"
                    style={{ transform: `rotate(${(i % 3 - 1) * 1.5}deg)` }}
                  >
                    <div className="h-2 w-1/2 rounded-full bg-muted" />
                    <div className="h-2 w-1/3 rounded-full bg-muted" />
                    <div className="mt-2 h-10 rounded-lg bg-gradient-fresh" />
                    <div className="grid grid-cols-3 gap-1 mt-1">
                      <div className="h-6 rounded bg-muted" />
                      <div className="h-6 rounded bg-muted" />
                      <div className="h-6 rounded bg-muted" />
                    </div>
                  </div>
                </div>
                <div className="p-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{p.tag}</p>
                    <p className="font-display text-lg font-semibold truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">by {p.maker}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Heart className="size-3.5 text-rose fill-rose/30" /> {p.likes}
                    </span>
                    <span className="size-9 rounded-full bg-muted grid place-items-center group-hover:bg-ink group-hover:text-cream transition-colors">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
