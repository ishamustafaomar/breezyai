import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Sparkles, ArrowUp, Code2, Eye, Smartphone, Monitor, Tablet,
  Layers, Plus, Share2, Rocket, ChevronLeft, FileCode2, Square,
} from "lucide-react";
import { streamChat } from "@/lib/chat-stream";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Breezy Builder — Your AI dev studio" },
      { name: "description", content: "The Breezy builder. Chat to design, edit code, and preview live." },
    ],
  }),
  component: BuilderApp,
});

type Msg = { role: "user" | "assistant"; content: string };

const STARTER: Msg[] = [
  {
    role: "assistant",
    content:
      "Hey! I'm **Breezy** ✨ Tell me what you want to build — even a half-baked idea is great. I'll sketch it out and we can shape it together.",
  },
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
  const [streaming, setStreaming] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [generatedHtml, setGeneratedHtml] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const generate = async (history: Msg[]) => {
    genAbortRef.current?.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;
    setGenerating(true);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const { error } = await resp.json().catch(() => ({ error: "Generation failed" }));
        toast.error(error || "Generation failed");
        return;
      }
      const { html } = (await resp.json()) as { html: string };
      if (html) setGeneratedHtml(html);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error((e as Error).message || "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Kick off real site generation in parallel with the chat reply.
    generate(next);

    let acc = "";
    await streamChat({
      messages: next,
      signal: controller.signal,
      onDelta: (chunk) => {
        acc += chunk;
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      },
      onError: (err) => {
        toast.error(err);
        setMessages((prev) => prev.slice(0, -1));
      },
      onDone: () => {},
    });
    setStreaming(false);
    abortRef.current = null;
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    genAbortRef.current?.abort();
    genAbortRef.current = null;
    setStreaming(false);
    setGenerating(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Toaster position="top-center" />
      <BuilderTopBar />
      <div className="flex-1 grid lg:grid-cols-[400px_1fr] min-h-0">
        {/* Chat */}
        <aside className="flex flex-col border-r border-border bg-card/40 min-h-0">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Conversation</span>
            </div>
            <button
              onClick={() => { stop(); setMessages(STARTER); setGeneratedHtml(""); }}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Plus className="size-3.5" /> New
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <Message key={i} msg={m} streaming={streaming && i === messages.length - 1 && m.role === "assistant"} />
            ))}
            {messages.length === 1 && !streaming && (
              <div className="pt-2 grid gap-2">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    onClick={() => send(`I want to build ${idea}.`)}
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
                placeholder={streaming ? "Breezy is replying…" : "Describe a change…"}
                className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground max-h-32"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="size-8 rounded-full bg-ink text-cream grid place-items-center hover:scale-105 transition"
                  aria-label="Stop"
                >
                  <Square className="size-3.5 fill-cream" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="size-8 rounded-full bg-ink text-cream grid place-items-center hover:scale-105 transition disabled:opacity-40 disabled:scale-100"
                  aria-label="Send"
                >
                  <ArrowUp className="size-4" strokeWidth={2.5} />
                </button>
              )}
            </form>
            <p className="text-[11px] text-muted-foreground mt-2 px-1">
              Shift + Enter for new line · Powered by Lovable AI
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
            {view === "preview"
              ? <PreviewCanvas device={device} html={generatedHtml} generating={generating} />
              : <CodeView html={generatedHtml} />}
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

/** Tiny markdown-ish renderer: **bold**, `code`, bullets, line breaks. No deps. */
function renderInline(text: string) {
  const parts: (string | ReactNode)[] = [];
  let i = 0;
  let key = 0;
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) parts.push(text.slice(i, m.index));
    if (m[2]) parts.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3]) parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-card text-[12px] font-mono">{m[3]}</code>);
    i = m.index + m[0].length;
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

function MessageContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (k: number) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`u${k}`} className="list-disc pl-5 space-y-1">
        {bullets.map((b, i) => <li key={i}>{renderInline(b)}</li>)}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else {
      flushBullets(idx);
      if (line.trim()) out.push(<p key={idx}>{renderInline(line)}</p>);
    }
  });
  flushBullets(999);
  return <div className="space-y-2 text-sm leading-relaxed">{out}</div>;
}

function Message({ msg, streaming }: { msg: Msg; streaming?: boolean }) {
  if (msg.role === "user") {
    return (
      <div className="flex gap-3 justify-end animate-pop-in">
        <div className="rounded-2xl rounded-tr-sm bg-ink text-cream px-4 py-2.5 text-sm max-w-[85%]">{msg.content}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 animate-pop-in">
      <Avatar />
      <div className="space-y-2 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 min-w-[40px]">
          {msg.content ? (
            <>
              <MessageContent text={msg.content} />
              {streaming && <span className="ml-0.5 inline-block w-[2px] h-[1em] translate-y-1 bg-primary animate-blink rounded-sm" />}
            </>
          ) : (
            <span className="inline-flex gap-0.5">
              <span className="size-1.5 rounded-full bg-ink/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-1.5 rounded-full bg-ink/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-1.5 rounded-full bg-ink/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          )}
        </div>
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
