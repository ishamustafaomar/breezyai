import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroChatMock } from "@/components/hero-chat-mock";
import {
  Sparkles, Wand2, Layers, Zap, Code2, Palette, Globe, MessageSquareHeart,
  Database, ShieldCheck, Rocket, ArrowRight, Star, Heart, Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Breezy — Vibe-code beautiful apps in minutes" },
      { name: "description", content: "Breezy is the friendliest AI builder for shipping web apps. Describe it, watch it appear, tweak it live." },
      { property: "og:title", content: "Breezy — Vibe-code beautiful apps" },
      { property: "og:description", content: "The friendliest AI builder for shipping web apps. Describe, see, ship." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <ShowcasePreview />
        <Comparison />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero opacity-90 pointer-events-none" />
      <div className="absolute inset-0 grain pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-5 pt-16 sm:pt-24 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-card/80 backdrop-blur border border-border px-3 py-1.5 text-xs font-medium shadow-soft animate-pop-in">
            <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            Now in public beta · v2.0
            <span className="text-muted-foreground">— streaming previews</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95]">
            Vibe-code your<br />
            <span className="relative inline-block">
              <span className="relative z-10">next big idea</span>
              <span className="absolute -bottom-2 left-0 right-0 h-3 bg-peach/70 rounded-full -z-0" />
            </span>
            .
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
            Describe what you want in plain English. Breezy designs, builds, and ships a real
            full-stack app — beautiful by default, yours to remix.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 py-3.5 font-semibold shadow-glow hover:scale-[1.03] transition-all"
            >
              Start building free
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/showcase"
              className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-6 py-3.5 font-semibold hover:bg-muted transition"
            >
              See what people built
            </Link>
          </div>

          <div className="flex items-center gap-3 pt-4 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-mint animate-pulse" />
            Live streaming previews — see your site appear as it's typed.
          </div>
        </div>

        <HeroChatMock />
      </div>
    </section>
  );
}

function LogoMarquee() {
  const logos = ["Acme", "Lumen", "Northwind", "Globex", "Initech", "Pied Piper", "Soylent", "Hooli", "Massive Dynamic", "Wayne Ent."];
  return (
    <section className="border-y border-border/60 bg-card/40 py-8 overflow-hidden">
      <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
        Teams shipping with Breezy
      </p>
      <div className="relative">
        <div className="flex gap-12 animate-marquee whitespace-nowrap">
          {[...logos, ...logos].map((l, i) => (
            <span key={i} className="font-display text-2xl font-semibold text-foreground/40 hover:text-foreground transition">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Wand2, title: "Conversational builder", desc: "Type a thought, see it become real UI in seconds. No setup, no boilerplate.", tint: "bg-gradient-warm" },
  { icon: Palette, title: "Designed by default", desc: "Every app ships with a coherent palette, type scale, and animations. Effortlessly tasteful.", tint: "bg-gradient-cool" },
  { icon: Database, title: "Cloud built-in", desc: "Auth, database, storage, and serverless functions — provisioned automatically.", tint: "bg-gradient-fresh" },
  { icon: Code2, title: "Real code you own", desc: "TypeScript, React, Tailwind. Edit by chat or jump into the code anytime.", tint: "bg-gradient-rainbow" },
  { icon: Globe, title: "One-click publish", desc: "Custom domains, SSL, edge hosting. Share a real URL the moment you're proud.", tint: "bg-gradient-warm" },
  { icon: ShieldCheck, title: "Safe to play", desc: "Time-travel undo, branches, and previews. Break things bravely — nothing is permanent.", tint: "bg-gradient-cool" },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-24">
      <div className="max-w-2xl mb-14">
        <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Why Breezy</p>
        <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
          Everything you need.<br />
          <span className="text-muted-foreground">Nothing in your way.</span>
        </h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative rounded-3xl bg-card border border-border p-6 shadow-soft hover:shadow-card hover:-translate-y-1 transition-all"
          >
            <div className={`size-12 rounded-2xl ${f.tint} grid place-items-center shadow-soft mb-4 group-hover:rotate-6 transition-transform`}>
              <f.icon className="size-5 text-ink" strokeWidth={2.25} />
            </div>
            <h3 className="font-display text-xl font-semibold mb-1.5">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Describe the vibe", desc: "Tell Breezy what you're imagining — even half-baked ideas welcome.", icon: MessageSquareHeart, tint: "bg-peach" },
    { n: "02", title: "Watch it appear", desc: "A complete, styled, working app streams into the preview pane in real time.", icon: Sparkles, tint: "bg-mint" },
    { n: "03", title: "Tweak by chatting", desc: "“Make the hero bigger.” “Add a contact form.” It just happens.", icon: Wand2, tint: "bg-lavender" },
    { n: "04", title: "Ship it to the world", desc: "Publish to a custom domain in one click. Share, sell, or scale.", icon: Rocket, tint: "bg-sky" },
  ];
  return (
    <section id="how" className="relative py-24 bg-gradient-to-b from-background via-muted/30 to-background">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-2xl mb-14">
          <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">How it works</p>
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            From idea to live app<br />in four breaths.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-3xl bg-card border border-border p-6 shadow-soft animate-pop-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`absolute -top-4 -left-4 size-14 rounded-2xl ${s.tint} grid place-items-center shadow-soft rotate-[-6deg]`}>
                <s.icon className="size-6 text-ink" strokeWidth={2.25} />
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-4 mb-2">STEP {s.n}</div>
              <h3 className="font-display text-xl font-semibold mb-1.5">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcasePreview() {
  const cards = [
    { title: "Sunday Recipes", tag: "Food app", color: "bg-gradient-warm" },
    { title: "Stoic Daily", tag: "Journaling", color: "bg-gradient-cool" },
    { title: "Sprout", tag: "Plant care", color: "bg-gradient-fresh" },
    { title: "Loop Fitness", tag: "Workouts", color: "bg-gradient-rainbow" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Showcase</p>
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Built in an afternoon.<br />Loved every day.
          </h2>
        </div>
        <Link to="/showcase" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary">
          Browse the gallery <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <div
            key={c.title}
            className="group relative aspect-[3/4] rounded-3xl overflow-hidden border border-border shadow-soft hover:shadow-card hover:-translate-y-1 transition-all"
          >
            <div className={`absolute inset-0 ${c.color}`} />
            <div className="absolute inset-0 grain" />
            <div
              className="absolute inset-x-6 top-12 bottom-20 rounded-2xl bg-card/90 backdrop-blur shadow-soft p-4 flex flex-col gap-2 group-hover:translate-y-[-4px] transition-transform"
              style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 2}deg)` }}
            >
              <div className="h-3 w-3/5 rounded-full bg-muted" />
              <div className="h-3 w-2/5 rounded-full bg-muted" />
              <div className="mt-2 h-12 rounded-xl bg-gradient-fresh" />
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                <div className="h-8 rounded-lg bg-muted" />
                <div className="h-8 rounded-lg bg-muted" />
                <div className="h-8 rounded-lg bg-muted" />
              </div>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-ink/70 to-transparent text-cream">
              <p className="text-xs uppercase tracking-wider opacity-80">{c.tag}</p>
              <p className="font-display text-xl font-semibold">{c.title}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Comparison() {
  const rows = [
    ["Time to first prototype", "30 seconds", "2 weeks"],
    ["Setup required", "None", "Hours of config"],
    ["Design quality", "Tasteful by default", "Depends on you"],
    ["Backend included", "Yes", "Sold separately"],
    ["Real code you own", "Yes", "Sometimes"],
    ["Joy", "Quite a lot", "Variable"],
  ];
  return (
    <section className="mx-auto max-w-5xl px-5 py-24">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Why switch</p>
        <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
          Breezy vs. the old way.
        </h2>
      </div>

      <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
        <div className="grid grid-cols-3 px-6 py-4 text-sm font-semibold border-b border-border bg-muted/40">
          <div></div>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-lg bg-gradient-warm grid place-items-center"><Sparkles className="size-3 text-ink" strokeWidth={2.5} /></div>
            Breezy
          </div>
          <div className="text-muted-foreground">Traditional dev</div>
        </div>
        {rows.map(([label, a, b], i) => (
          <div key={i} className={`grid grid-cols-3 px-6 py-4 text-sm ${i % 2 ? "bg-muted/20" : ""}`}>
            <div className="text-muted-foreground">{label}</div>
            <div className="font-medium flex items-center gap-2"><Check className="size-4 text-primary" /> {a}</div>
            <div className="text-muted-foreground">{b}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    { q: "I shipped a full SaaS in a weekend. My designer cried (happy tears).", a: "Maya R.", role: "Founder, Lumen" },
    { q: "Breezy turned my chaotic ideas into something my team could actually use on Monday.", a: "Diego P.", role: "PM, Globex" },
    { q: "It's the first AI tool that doesn't make my apps look like 2014.", a: "Sasha K.", role: "Indie maker" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <div className="grid md:grid-cols-3 gap-5">
        {quotes.map((t, i) => (
          <div
            key={i}
            className="rounded-3xl bg-card border border-border p-7 shadow-soft hover:shadow-card transition-all relative"
          >
            <Heart className="absolute top-6 right-6 size-5 text-rose fill-rose/30" />
            <p className="font-display text-lg leading-snug mb-6">"{t.q}"</p>
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-full ${["bg-peach", "bg-mint", "bg-lavender"][i]}`} />
              <div>
                <p className="text-sm font-semibold">{t.a}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-24">
      <div className="rounded-[2.5rem] bg-gradient-rainbow p-1 shadow-card">
        <div className="rounded-[2.25rem] bg-card p-10 sm:p-14 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">Pricing</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Free to play.<br />Pay when you ship.
            </h2>
            <p className="text-muted-foreground">
              Start building unlimited prototypes for free. Upgrade only when you publish to a real domain.
            </p>
          </div>
          <div className="space-y-3">
            {[
              "Unlimited prototypes",
              "Live preview & sharing",
              "Built-in database & auth",
              "Custom domain on Pro",
              "Real code export",
            ].map((p) => (
              <div key={p} className="flex items-center gap-3 text-sm">
                <div className="size-6 rounded-full bg-mint grid place-items-center">
                  <Check className="size-3.5 text-ink" strokeWidth={3} />
                </div>
                {p}
              </div>
            ))}
            <Link
              to="/pricing"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-3 text-sm font-semibold hover:scale-[1.03] transition"
            >
              See plans <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-medium shadow-soft mb-6">
        <Zap className="size-3.5 text-primary" />
        Your first app in under a minute
      </div>
      <h2 className="font-display text-5xl sm:text-6xl font-bold tracking-tight mb-5">
        What will you<br />
        <span className="bg-gradient-rainbow bg-clip-text text-transparent">make today?</span>
      </h2>
      <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
        No credit card. No installs. Just type your first idea — Breezy will do the rest.
      </p>
      <Link
        to="/app"
        className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-7 py-4 font-semibold shadow-glow hover:scale-[1.04] transition-all text-lg"
      >
        Open the builder
        <Sparkles className="size-5" />
      </Link>
    </section>
  );
}
