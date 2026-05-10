import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Sparkles, ArrowUp, Code2, Eye, Smartphone, Monitor, Tablet,
  Layers, Plus, Share2, Rocket, ChevronLeft, FileCode2, Wand2, Check,
} from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Breezy Builder — Your AI dev studio" },
      { name: "description", content: "The Breezy builder. Chat to design, edit code, and preview live." },
    ],
  }),
  component: BuilderApp,
});

type Msg = { role: "user" | "ai"; text: string; tags?: string[] };

const STARTER: Msg[] = [
  { role: "ai", text: "Welcome to Breezy ✨ Tell me what you'd like to build, or pick an idea below to get started." },
];

const IDEAS = [
  "A cozy meditation app",
  "A landing page for my bakery",
  "A todo list with streaks",
  "A SaaS pricing page",
];

function BuilderApp() {
  const [messages, setMessages] = useState<Msg[]>(STARTER);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = (text: string) => {
    if (!text.trim() || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Got it — I built a first version. Check the preview! Want me to adjust the colors, add a feature, or hook up the database?",
          tags: ["Layout", "Hero section", "Features grid", "Color palette", "Responsive"],
        },
      ]);
      setSending(false);
    }, 1400);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <BuilderTopBar />
      <div className="flex-1 grid lg:grid-cols-[400px_1fr] min-h-0">
        {/* Chat */}
        <aside className="flex flex-col border-r border-border bg-card/40 min-h-0">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Conversation</span>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <Plus className="size-3.5" /> New
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <Message key={i} msg={m} />
            ))}
            {sending && (
              <div className="flex gap-3">
                <Avatar />
                <div className="rounded-2xl rounded-tl-sm bg-gradient-rainbow bg-[length:200%_100%] animate-shimmer px-4 py-3 text-sm">
                  <span className="font-medium">Thinking</span>
                  <span className="inline-flex gap-0.5 ml-1">
                    <span className="size-1 rounded-full bg-ink animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1 rounded-full bg-ink animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1 rounded-full bg-ink animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="pt-2 grid gap-2">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    onClick={() => send(idea)}
                    className="text-left text-sm rounded-2xl border border-border bg-card hover:bg-muted px-4 py-3 transition flex items-center justify-between group"
                  >
                    <span>{idea}</span>
                    <Sparkles className="size-3.5 text-primary opacity-0 group-hover:opacity-100 transition" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border bg-background/60">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-end gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 ring-primary/30 transition"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Describe a change…"
                className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground max-h-32"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="size-8 rounded-full bg-ink text-cream grid place-items-center hover:scale-105 transition disabled:opacity-40 disabled:scale-100"
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            </form>
            <p className="text-[11px] text-muted-foreground mt-2 px-1">
              Shift + Enter for new line · Breezy may make mistakes
            </p>
          </div>
        </aside>

        {/* Canvas */}
        <section className="flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 bg-card/40">
            <div className="inline-flex rounded-full bg-muted p-1 text-xs font-semibold">
              <button
                onClick={() => setView("preview")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${view === "preview" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
              >
                <Eye className="size-3.5" /> Preview
              </button>
              <button
                onClick={() => setView("code")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${view === "code" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
              >
                <Code2 className="size-3.5" /> Code
              </button>
            </div>

            {view === "preview" && (
              <div className="inline-flex rounded-full bg-muted p-1">
                {[
                  { v: "mobile" as const, Icon: Smartphone },
                  { v: "tablet" as const, Icon: Tablet },
                  { v: "desktop" as const, Icon: Monitor },
                ].map(({ v, Icon }) => (
                  <button
                    key={v}
                    onClick={() => setDevice(v)}
                    className={`size-8 grid place-items-center rounded-full transition ${device === v ? "bg-card shadow-soft" : "text-muted-foreground"}`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted">
                <Share2 className="size-3.5" /> Share
              </button>
              <button className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-ink text-cream hover:scale-[1.03] transition">
                <Rocket className="size-3.5" /> Publish
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-muted/30 via-background to-muted/30">
            {view === "preview" ? <PreviewCanvas device={device} /> : <CodeView />}
          </div>
        </section>
      </div>
    </div>
  );
}

function BuilderTopBar() {
  return (
    <div className="h-14 border-b border-border bg-card/60 backdrop-blur flex items-center px-4 gap-3 shrink-0">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Back
      </Link>
      <div className="size-6 w-px bg-border" />
      <Link to="/" className="flex items-center gap-2">
        <div className="size-7 rounded-lg bg-gradient-warm grid place-items-center shadow-soft">
          <Sparkles className="size-3.5 text-ink" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold">breezy</span>
      </Link>
      <div className="size-6 w-px bg-border" />
      <input
        defaultValue="Untitled project"
        className="bg-transparent text-sm font-medium outline-none focus:bg-muted px-2 py-1 rounded-md max-w-[220px]"
      />
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-mint animate-pulse" /> Auto-saved
        </span>
        <div className="size-8 rounded-full bg-gradient-cool border-2 border-background" />
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="shrink-0 size-8 rounded-2xl bg-gradient-warm grid place-items-center shadow-soft">
      <Sparkles className="size-3.5 text-ink" strokeWidth={2.5} />
    </div>
  );
}

function Message({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex gap-3 justify-end animate-pop-in">
        <div className="rounded-2xl rounded-tr-sm bg-ink text-cream px-4 py-2.5 text-sm max-w-[85%]">{msg.text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 animate-pop-in">
      <Avatar />
      <div className="space-y-2 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">{msg.text}</div>
        {msg.tags && (
          <div className="flex flex-wrap gap-1.5">
            {msg.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-card border border-border">
                <Check className="size-3 text-primary" strokeWidth={3} /> {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewCanvas({ device }: { device: "mobile" | "tablet" | "desktop" }) {
  const widths = { mobile: "max-w-[380px]", tablet: "max-w-[820px]", desktop: "max-w-[1200px]" };
  return (
    <div className={`mx-auto w-full ${widths[device]} transition-all`}>
      <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-rose" />
            <span className="size-2.5 rounded-full bg-butter" />
            <span className="size-2.5 rounded-full bg-mint" />
          </div>
          <div className="ml-3 text-xs text-muted-foreground font-mono">untitled.breezy.app</div>
        </div>

        {/* Mock generated app */}
        <div className="p-8 sm:p-12 bg-gradient-hero relative">
          <div className="absolute inset-0 grain" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-card/80 backdrop-blur px-3 py-1 text-[11px] font-medium border border-border mb-5">
              <span className="size-1.5 rounded-full bg-mint" /> Now serving calm
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight max-w-md leading-[1.05]">
              Find your<br />
              <span className="bg-gradient-warm bg-clip-text text-transparent">moment of stillness</span>.
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mt-4">
              Breath by breath, day by day. A meditation companion that meets you where you are.
            </p>
            <div className="flex gap-2 mt-6">
              <button className="rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-semibold">Begin</button>
              <button className="rounded-full bg-card border border-border px-5 py-2.5 text-sm font-semibold">Listen</button>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 grid sm:grid-cols-3 gap-3 bg-card">
          {[
            { t: "Daily breath", c: "bg-gradient-fresh" },
            { t: "Sleep stories", c: "bg-gradient-cool" },
            { t: "Focus timers", c: "bg-gradient-warm" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border p-4 bg-card shadow-soft">
              <div className={`size-10 rounded-xl ${f.c} mb-3`} />
              <p className="font-display font-semibold">{f.t}</p>
              <p className="text-xs text-muted-foreground mt-1">A short blurb that explains the lovely thing.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CodeView() {
  const files = [
    { n: "src/routes/index.tsx", active: true },
    { n: "src/components/hero.tsx" },
    { n: "src/components/feature-grid.tsx" },
    { n: "src/styles.css" },
  ];
  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-ink text-cream shadow-card overflow-hidden grid grid-cols-[200px_1fr] min-h-[500px]">
      <div className="border-r border-white/10 p-3 text-xs">
        <p className="px-2 py-1.5 text-cream/50 uppercase tracking-wider">Files</p>
        {files.map((f) => (
          <div
            key={f.n}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer ${f.active ? "bg-white/10" : "hover:bg-white/5 text-cream/70"}`}
          >
            <FileCode2 className="size-3.5 shrink-0" />
            <span className="truncate">{f.n}</span>
          </div>
        ))}
      </div>
      <pre className="p-5 text-[12.5px] font-mono leading-relaxed overflow-auto">
{`import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/hero";
import { FeatureGrid } from "@/components/feature-grid";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-hero">
      <Hero
        eyebrow="Now serving calm"
        title="Find your moment of stillness"
        cta="Begin"
      />
      <FeatureGrid items={[
        { title: "Daily breath", color: "fresh" },
        { title: "Sleep stories", color: "cool" },
        { title: "Focus timers", color: "warm" },
      ]} />
    </main>
  );
}`}
      </pre>
    </div>
  );
}
