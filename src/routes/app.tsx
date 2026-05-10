import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Sparkles, ArrowUp, Code2, Eye, Smartphone, Monitor, Tablet,
  Layers, Plus, Share2, Rocket, ChevronLeft, FileCode2, Square, Check, Copy, Download,
  History, ExternalLink, RotateCcw,
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

type BuildStatus = {
  phase: string;
  progress: number; // 0-100
  done: boolean;
  error?: string;
};

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; build?: BuildStatus };

const STARTER: Msg[] = [
  {
    role: "assistant",
    content:
      "Hey! I'm **Breezy** ✨ Tell me what you want to build — even a half-baked idea is great. I'll design it live and we can shape it together.",
  },
];

const IDEAS = [
  "A cozy meditation app",
  "A landing page for my bakery",
  "A todo list with streaks",
  "A SaaS pricing page",
];

const PHASES = [
  "Sketching the layout",
  "Choosing a color palette",
  "Writing the copy",
  "Designing the hero",
  "Wiring up sections",
  "Polishing the details",
  "Finalizing markup",
];

type Version = { id: string; html: string; prompt: string; createdAt: number };

const STORAGE_KEY = "breezy.project.v1";

function BuilderApp() {
  const [messages, setMessages] = useState<Msg[]>(STARTER);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [generatedHtml, setGeneratedHtml] = useState<string>("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [projectName, setProjectName] = useState<string>("Untitled project");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        messages?: Msg[]; versions?: Version[]; activeVersionId?: string; name?: string;
      };
      if (data.messages?.length) setMessages(data.messages);
      if (data.versions?.length) {
        setVersions(data.versions);
        const active = data.versions.find((v) => v.id === data.activeVersionId) ?? data.versions[data.versions.length - 1];
        if (active) {
          setActiveVersionId(active.id);
          setGeneratedHtml(active.html);
        }
      }
      if (data.name) setProjectName(data.name);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages, versions, activeVersionId, name: projectName }),
      );
    } catch {
      /* quota: ignore */
    }
  }, [messages, versions, activeVersionId, projectName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Update the last assistant message's build status
  const patchBuild = (patch: Partial<BuildStatus>) => {
    setMessages((prev) => {
      const copy = prev.slice();
      for (let i = copy.length - 1; i >= 0; i--) {
        const m = copy[i];
        if (m.role === "assistant" && m.build) {
          copy[i] = { ...m, build: { ...m.build, ...patch } };
          break;
        }
      }
      return copy;
    });
  };

  const startPhaseTicker = () => {
    let idx = 0;
    phaseTimerRef.current && clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, PHASES.length - 1);
      patchBuild({ phase: PHASES[idx] });
    }, 2800);
  };
  const stopPhaseTicker = () => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = null;
  };

  const generate = async (history: Msg[]) => {
    genAbortRef.current?.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;
    setGeneratedHtml("");
    startPhaseTicker();

    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        const { error } = await resp.json().catch(() => ({ error: "Generation failed" }));
        toast.error(error || "Generation failed");
        patchBuild({ done: true, error: error || "Generation failed", progress: 100, phase: "Failed" });
        return null;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let html = "";
      const TARGET = 22000; // bytes ≈ ~95%
      // Don't update the iframe per chunk — it causes constant reloads and
      // makes the final render feel laggy. Just track progress; render once on done.
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        const pct = Math.min(95, Math.round((html.length / TARGET) * 95));
        patchBuild({ progress: pct });
      }
      // Strip accidental fences just in case
      html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
      if (!html.toLowerCase().startsWith("<!doctype") && !html.toLowerCase().startsWith("<html")) {
        html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body>${html}</body></html>`;
      }
      setGeneratedHtml(html);
      patchBuild({ progress: 100, phase: "Ready", done: true });
      return html;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error((e as Error).message || "Generation failed");
        patchBuild({ done: true, error: (e as Error).message, progress: 100, phase: "Failed" });
      } else {
        patchBuild({ done: true, phase: "Stopped", progress: 100 });
      }
      return null;
    } finally {
      stopPhaseTicker();
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const buildMsg: Msg = {
      role: "assistant",
      content: "",
      build: { phase: PHASES[0], progress: 3, done: false },
    };
    const next = [...messages, userMsg];
    setMessages([...next, buildMsg]);
    setInput("");
    setBusy(true);

    // 1) Generate site (with live progress)
    const html = await generate(next);

    // 2) Brief chat summary AFTER build (so it doesn't ramble while building)
    if (html) {
      const summaryController = new AbortController();
      abortRef.current = summaryController;
      let acc = "";
      await streamChat({
        messages: [
          ...next,
          {
            role: "user",
            content:
              "I just generated a website for the request above. In 1–2 short, friendly sentences, tell me what you built and suggest one specific tweak I could ask for next. Do NOT describe the code or say the word 'HTML'.",
          },
        ],
        signal: summaryController.signal,
        onDelta: (chunk) => {
          acc += chunk;
          setMessages((prev) => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: acc };
            }
            return copy;
          });
        },
        onError: () => {
          /* silent — build already succeeded */
        },
        onDone: () => {},
      });
      abortRef.current = null;
    }

    setBusy(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    genAbortRef.current?.abort();
    genAbortRef.current = null;
    stopPhaseTicker();
    setBusy(false);
  };

  const lastBuild = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.build && !m.build.done) return m.build;
    }
    return null;
  })();

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
              <Message key={i} msg={m} />
            ))}
            {messages.length === 1 && !busy && (
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
            {!busy && generatedHtml && messages.length > 1 && (
              <div className="pt-1 flex flex-wrap gap-1.5">
                {[
                  "Make it darker and more premium",
                  "Add a testimonials section",
                  "Try a different color palette",
                  "Make the hero more bold",
                  "Add a pricing section",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs rounded-full border border-border bg-card hover:bg-muted px-3 py-1.5 transition text-muted-foreground hover:text-foreground"
                  >
                    {s}
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
                placeholder={busy ? "Breezy is building…" : "Describe a change…"}
                className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-muted-foreground max-h-32"
              />
              {busy ? (
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

            <div className="flex items-center gap-1">
              <button
                disabled={!generatedHtml}
                onClick={() => {
                  navigator.clipboard.writeText(generatedHtml);
                  toast.success("HTML copied to clipboard");
                }}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted disabled:opacity-40"
                title="Copy HTML"
              >
                <Copy className="size-3.5" /> Copy
              </button>
              <button
                disabled={!generatedHtml}
                onClick={() => {
                  const blob = new Blob([generatedHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "index.html";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted disabled:opacity-40"
                title="Download HTML"
              >
                <Download className="size-3.5" /> Download
              </button>
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
              ? <PreviewCanvas device={device} html={generatedHtml} build={lastBuild} />
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

function BuildCard({ build }: { build: BuildStatus }) {
  const steps = PHASES;
  const activeIdx = Math.min(
    steps.length - 1,
    Math.floor((build.progress / 100) * steps.length),
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            {!build.done && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            )}
            <span className={`relative inline-flex rounded-full size-2 ${build.done ? (build.error ? "bg-rose" : "bg-mint") : "bg-primary"}`} />
          </span>
          <span className="text-sm font-semibold">
            {build.done ? (build.error ? "Build failed" : "Site ready") : "Building your site"}
          </span>
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">{build.progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary via-primary to-primary/70 transition-[width] duration-500 ease-out"
          style={{ width: `${build.progress}%` }}
        />
      </div>

      {/* Phase list */}
      <ul className="space-y-1.5 pt-1">
        {steps.map((s, i) => {
          const done = build.done ? !build.error : i < activeIdx;
          const active = !build.done && i === activeIdx;
          return (
            <li key={s} className="flex items-center gap-2 text-xs">
              <span className={`size-4 rounded-full grid place-items-center shrink-0 ${done ? "bg-mint text-ink" : active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="size-2.5" strokeWidth={3} /> : active ? (
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                ) : <span className="size-1 rounded-full bg-muted-foreground/40" />}
              </span>
              <span className={done ? "text-muted-foreground line-through decoration-muted-foreground/40" : active ? "text-foreground font-medium" : "text-muted-foreground"}>
                {active ? `${s}…` : s}
              </span>
            </li>
          );
        })}
      </ul>

      {build.error && (
        <p className="text-xs text-rose-foreground bg-rose/10 border border-rose/30 rounded-lg px-2.5 py-1.5">
          {build.error}
        </p>
      )}
    </div>
  );
}

function Message({ msg }: { msg: Msg }) {
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
      <div className="space-y-2 max-w-[85%] w-full">
        {msg.build && <BuildCard build={msg.build} />}
        {msg.content && (
          <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
            <MessageContent text={msg.content} />
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewCanvas({
  device,
  html,
  build,
}: {
  device: "mobile" | "tablet" | "desktop";
  html: string;
  build: BuildStatus | null;
}) {
  const widths = { mobile: "max-w-[380px]", tablet: "max-w-[820px]", desktop: "max-w-[1200px]" };
  const heights = { mobile: "h-[720px]", tablet: "h-[820px]", desktop: "h-[760px]" };
  const generating = !!build && !build.done;
  return (
    <div className={`mx-auto w-full ${widths[device]} transition-all`}>
      <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-rose" />
            <span className="size-2.5 rounded-full bg-butter" />
            <span className="size-2.5 rounded-full bg-mint" />
          </div>
          <div className="ml-3 text-xs text-muted-foreground font-mono flex-1 truncate">
            untitled.breezy.app
          </div>
          {generating && (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              {build?.phase} · {build?.progress}%
            </span>
          )}
        </div>

        {html ? (
          <div className="relative">
            <iframe
              title="Generated preview"
              srcDoc={html}
              sandbox="allow-scripts"
              className={`w-full ${heights[device]} bg-white`}
            />
            {generating && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-500"
                  style={{ width: `${build?.progress ?? 0}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <EmptyPreview build={build} />
        )}
      </div>
    </div>
  );
}

function EmptyPreview({ build }: { build: BuildStatus | null }) {
  const generating = !!build && !build.done;
  return (
    <div className="p-12 bg-gradient-hero relative min-h-[480px] grid place-items-center text-center">
      <div className="absolute inset-0 grain" />
      <div className="relative max-w-sm space-y-4">
        <div className="mx-auto size-14 rounded-2xl bg-gradient-warm grid place-items-center shadow-soft">
          <Sparkles className="size-6 text-ink" strokeWidth={2.5} />
        </div>
        <h2 className="font-display text-2xl font-bold">
          {generating ? `${build?.phase}…` : "Tell Breezy what to build"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {generating
            ? "Designing your site live. The preview will appear as it builds."
            : "Send a message in the chat and a real, live website will appear right here."}
        </p>
        {generating && (
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${build?.progress ?? 0}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CodeView({ html }: { html: string }) {
  const code = html || "<!-- Send a message to Breezy and the generated HTML will appear here. -->";
  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-ink text-cream shadow-card overflow-hidden grid grid-cols-[200px_1fr] min-h-[500px]">
      <div className="border-r border-white/10 p-3 text-xs">
        <p className="px-2 py-1.5 text-cream/50 uppercase tracking-wider">Files</p>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/10">
          <FileCode2 className="size-3.5 shrink-0" />
          <span className="truncate">index.html</span>
        </div>
      </div>
      <pre className="p-5 text-[12.5px] font-mono leading-relaxed overflow-auto whitespace-pre-wrap break-words">
        {code}
      </pre>
    </div>
  );
}
