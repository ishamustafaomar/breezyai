import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowUp,
  Code2,
  Eye,
  Smartphone,
  Monitor,
  Tablet,
  Layers,
  Plus,
  Share2,
  Rocket,
  ChevronLeft,
  FileCode2,
  Square,
  Check,
  Copy,
  Download,
  History,
  ExternalLink,
  RotateCcw,
  MessageSquare,
  Plug,
  Settings as SettingsIcon,
  Wand2,
  Globe,
  Pencil,
} from "lucide-react";
import { streamChat } from "@/lib/chat-stream";
import { Toaster } from "@/components/ui/sonner";
import {
  CONNECTORS,
  connectorContextBlock,
  isConnected,
  loadConnections,
  type Connection,
} from "@/lib/connectors";
import { ConnectorsPanel } from "@/components/builder/connectors-panel";
import { PlanCard, type Plan } from "@/components/builder/plan-card";
import { PublishDialog, type Deployment } from "@/components/builder/publish-dialog";
import { ProjectSettingsDialog } from "@/components/builder/project-settings-dialog";
import { useShortcuts } from "@/hooks/use-shortcuts";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Breezy Builder — Your AI dev studio" },
      {
        name: "description",
        content: "The Breezy builder. Chat to design, edit code, and preview live.",
      },
    ],
  }),
  component: BuilderApp,
});

type BuildStatus = {
  phase: string;
  phaseIndex: number;
  progress: number; // 0-100
  done: boolean;
  error?: string;
};

type PlanState = {
  plan: Plan | null;
  loading: boolean;
  status: "pending" | "approved" | "skipped";
  /** Captures the user prompt that triggered the plan so Approve can resume it. */
  userPrompt: string;
};

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; build?: BuildStatus; plan?: PlanState };

const STARTER: Msg[] = [
  {
    role: "assistant",
    content:
      "Hey! I'm **Breezy** ✨ Tell me what you want to build — even a half-baked idea is great. I'll plan it first, then design it live.",
  },
];

const IDEAS = [
  "A cozy meditation app",
  "A landing page for my bakery",
  "A todo list with streaks",
  "A SaaS pricing page",
];

/** Ordered by typical generation sequence; detectPhase returns the highest matched index. */
const PHASES: { id: string; label: string; match?: RegExp }[] = [
  { id: "plan", label: "Planning layout & structure" },
  { id: "doctype", label: "Scaffolding the document", match: /<!DOCTYPE\s+html>/i },
  { id: "head", label: "Loading Tailwind & fonts", match: /cdn\.tailwindcss\.com/i },
  { id: "theme", label: "Defining colors & typography", match: /tailwind\.config\s*=/i },
  { id: "base", label: "Setting base styles & motion", match: /<style[\s>]/i },
  { id: "nav", label: "Building navigation", match: /<nav[\s>]/i },
  {
    id: "hero",
    label: "Designing the hero",
    match: /<h1[\s>]|class="[^"]*\bhero\b|id="hero"/i,
  },
  {
    id: "features",
    label: "Crafting feature sections",
    match: /<section[\s>]/i,
  },
  {
    id: "proof",
    label: "Adding social proof",
    match: /testimonial|trusted\s+by|review|avatar/i,
  },
  {
    id: "convert",
    label: "Building pricing & CTAs",
    match: /pricing|faq|accordion|<details[\s>]/i,
  },
  { id: "footer", label: "Finishing footer & scripts", match: /<footer[\s>]/i },
  { id: "verify", label: "Verifying completion", match: /<\/html>/i },
];
const PHASE_LABELS = PHASES.map((p) => p.label);

const COMPLETION_MARKER_RE = /<!--BREEZY_GENERATION_STATUS:(.*?):BREEZY_GENERATION_STATUS-->/s;

function inspectGeneratedHtml(html: string) {
  const cleaned = html
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const lower = cleaned.toLowerCase();
  const hasDocumentStart = lower.startsWith("<!doctype") || lower.startsWith("<html");
  const hasDocumentEnd = lower.endsWith("</html>");
  const hasBody = lower.includes("<body") && lower.includes("</body>");
  return { cleaned, complete: hasDocumentStart && hasDocumentEnd && hasBody };
}

// Build a previewable doc from a partial stream by closing open tags so the
// iframe can render it live as it generates.
function previewableHtml(partial: string): string {
  const stripped = partial.replace(COMPLETION_MARKER_RE, "").trim();
  if (!stripped) return "";
  const cleaned = stripped.replace(/^```(?:html)?\s*/i, "");
  const lower = cleaned.toLowerCase();
  if (!lower.includes("<body")) return "";
  if (lower.includes("</html>")) return cleaned;
  const hasBodyClose = lower.includes("</body>");
  return cleaned + (hasBodyClose ? "" : "\n</body>") + "\n</html>";
}

// Detect the highest-progress phase reached given the partial streamed HTML.
function detectPhase(html: string): number {
  let idx = 0;
  for (let i = 0; i < PHASES.length; i++) {
    const p = PHASES[i];
    if (p.match?.test(html)) idx = i;
  }
  return idx;
}

function progressFromPhase(phaseIdx: number, htmlLength: number, targetLen: number): number {
  const phasePct = Math.round(((phaseIdx + 1) / PHASES.length) * 88);
  const lenPct = Math.round((htmlLength / targetLen) * 88);
  return Math.min(96, Math.max(phasePct, lenPct));
}

type Version = { id: string; html: string; prompt: string; createdAt: number };

const STORAGE_KEY = "breezy.project.v1";

type ActivePanel = "chat" | "connectors" | "history" | "settings" | "publish";

function BuilderApp() {
  const [messages, setMessages] = useState<Msg[]>(STARTER);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [generatedHtml, setGeneratedHtml] = useState<string>("");
  const [liveHtml, setLiveHtml] = useState<string>(""); // last published snapshot
  const [previewMode, setPreviewMode] = useState<"preview" | "live">("preview");
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("chat");
  const [projectName, setProjectName] = useState<string>("Untitled project");
  const [planMode, setPlanMode] = useState<boolean>(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
      if (raw) {
        const data = JSON.parse(raw) as {
          messages?: Msg[];
          versions?: Version[];
          activeVersionId?: string;
          name?: string;
          planMode?: boolean;
          deployments?: Deployment[];
          liveHtml?: string;
        };
        if (data.messages?.length) setMessages(data.messages);
        if (data.versions?.length) {
          setVersions(data.versions);
          const active =
            data.versions.find((v) => v.id === data.activeVersionId) ?? data.versions[data.versions.length - 1];
          if (active) {
            setActiveVersionId(active.id);
            setGeneratedHtml(active.html);
          }
        }
        if (data.name) setProjectName(data.name);
        if (typeof data.planMode === "boolean") setPlanMode(data.planMode);
        if (data.deployments?.length) setDeployments(data.deployments);
        if (data.liveHtml) setLiveHtml(data.liveHtml);
      }
    } catch {
      /* ignore */
    }
    setConnections(loadConnections());
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages,
          versions,
          activeVersionId,
          name: projectName,
          planMode,
          deployments,
          liveHtml,
        }),
      );
    } catch {
      /* quota */
    }
  }, [messages, versions, activeVersionId, projectName, planMode, deployments, liveHtml]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Keyboard shortcuts
  useShortcuts({
    onPlan: () => setPlanMode((p) => !p),
    onPublish: () => setPublishOpen(true),
    onFocusChat: () => {
      setActivePanel("chat");
      textareaRef.current?.focus();
    },
  });

  const activeConnectorNames = useMemo(
    () => CONNECTORS.filter((c) => isConnected(connections, c.id)).map((c) => c.name),
    [connections],
  );

  // ── Build status helpers ─────────────────────────────────────────────
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

  const patchPlan = (patch: Partial<PlanState>) => {
    setMessages((prev) => {
      const copy = prev.slice();
      for (let i = copy.length - 1; i >= 0; i--) {
        const m = copy[i];
        if (m.role === "assistant" && m.plan) {
          copy[i] = { ...m, plan: { ...m.plan, ...patch } };
          break;
        }
      }
      return copy;
    });
  };

  const phaseIdxRef = useRef(0);
  const startPhaseTicker = () => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = setInterval(() => {
      if (phaseIdxRef.current > 0) return;
      patchBuild({ phase: PHASE_LABELS[0], phaseIndex: 0, progress: 8 });
    }, 2200);
  };
  const stopPhaseTicker = () => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = null;
  };

  // ── Generate (HTML stream) ───────────────────────────────────────────
  const generate = async (history: Msg[], userPrompt: string): Promise<string | null> => {
    genAbortRef.current?.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;

    // Add a build placeholder right before we start (so plan card + build card live in same turn)
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        build: { phase: PHASE_LABELS[0], phaseIndex: 0, progress: 3, done: false },
      },
    ]);
    startPhaseTicker();

    const baseHtml = generatedHtml;
    const connectorsCtx = connectorContextBlock(connections);

    const doFetch = () =>
      fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m.content.trim())
            .map((m) => ({ role: m.role, content: m.content })),
          currentHtml: baseHtml || undefined,
          connectorsContext: connectorsCtx || undefined,
        }),
        signal: controller.signal,
      });

    try {
      let resp = await doFetch();
      if (resp.status === 429) {
        patchBuild({ phase: "Rate-limited, retrying" });
        await new Promise((r) => setTimeout(r, 4000));
        resp = await doFetch();
      }
      if (!resp.ok || !resp.body) {
        const { error } = await resp.json().catch(() => ({ error: "Generation failed" }));
        toast.error(error || "Generation failed");
        patchBuild({ done: true, error: error || "Generation failed", progress: 100, phase: "Failed", phaseIndex: PHASES.length - 1 });
        return null;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let html = "";
      const TARGET = 22000;
      let lastPreviewLen = 0;
      phaseIdxRef.current = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        const detected = detectPhase(html);
        phaseIdxRef.current = Math.max(phaseIdxRef.current, detected);
        const phaseIdx = phaseIdxRef.current;
        const pct = progressFromPhase(phaseIdx, html.length, TARGET);
        patchBuild({ progress: pct, phase: PHASE_LABELS[phaseIdx], phaseIndex: phaseIdx });
        if (html.length - lastPreviewLen > 600) {
          const live = previewableHtml(html);
          if (live) {
            setGeneratedHtml(live);
            lastPreviewLen = html.length;
          }
        }
      }
      html += decoder.decode();
      stopPhaseTicker();
      patchBuild({ phase: "Verifying completion", phaseIndex: PHASES.length - 1, progress: 98 });
      const marker = html.match(COMPLETION_MARKER_RE);
      const status = marker?.[1] ?? "missing-status";
      html = html.replace(COMPLETION_MARKER_RE, "");
      const inspected = inspectGeneratedHtml(html);
      html = inspected.cleaned;
      if (status !== "complete" || !inspected.complete) {
        setGeneratedHtml(baseHtml);
        const error =
          "The AI stream stopped before the site was complete, so I did not mark it finished. Please try again and I'll keep the current version unchanged.";
        toast.error("Build was incomplete — kept the previous version");
        patchBuild({ done: true, error, progress: 98, phase: "Incomplete", phaseIndex: phaseIdxRef.current });
        return null;
      }
      setGeneratedHtml(html);
      const v: Version = { id: crypto.randomUUID(), html, prompt: userPrompt, createdAt: Date.now() };
      setVersions((prev) => [...prev, v]);
      setActiveVersionId(v.id);
      patchBuild({ progress: 100, phase: "Finished and verified", phaseIndex: PHASES.length - 1, done: true });
      return html;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error((e as Error).message || "Generation failed");
        patchBuild({ done: true, error: (e as Error).message, progress: 100, phase: "Failed", phaseIndex: phaseIdxRef.current });
      } else {
        patchBuild({ done: true, error: "Build stopped before completion.", phase: "Stopped", phaseIndex: phaseIdxRef.current });
      }
      return null;
    } finally {
      stopPhaseTicker();
    }
  };

  // ── Post-build summary ──────────────────────────────────────────────
  const summarize = async (history: Msg[]) => {
    const summaryController = new AbortController();
    abortRef.current = summaryController;
    let acc = "";
    await streamChat({
      messages: [
        ...history,
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
          if (last.role === "assistant") copy[copy.length - 1] = { ...last, content: acc };
          return copy;
        });
      },
      onError: () => {},
      onDone: () => {},
    });
    abortRef.current = null;
  };

  // ── Plan flow ────────────────────────────────────────────────────────
  const runPlan = async (history: Msg[], userPrompt: string) => {
    // Append assistant plan placeholder
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        plan: { plan: null, loading: true, status: "pending", userPrompt },
      },
    ]);
    try {
      const resp = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          connectorsContext: connectorContextBlock(connections) || undefined,
        }),
      });
      const data = (await resp.json()) as Plan | { error: string };
      if (!resp.ok || "error" in data) {
        patchPlan({ loading: false, status: "skipped" });
        toast.error("Plan failed — building directly");
        return null;
      }
      patchPlan({ loading: false, plan: data });
      return data;
    } catch {
      patchPlan({ loading: false, status: "skipped" });
      return null;
    }
  };

  const approvePlan = async (history: Msg[], userPrompt: string) => {
    patchPlan({ status: "approved" });
    setBusy(true);
    const html = await generate(history, userPrompt);
    if (html) {
      await summarize([...history, { role: "assistant", content: "(built)" }]);
    }
    setBusy(false);
  };

  const skipPlan = () => {
    patchPlan({ status: "skipped" });
    setBusy(false);
  };

  // ── Send ────────────────────────────────────────────────────────────
  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setActivePanel("chat");
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    // Edit-mode (existing site): skip plan, generate directly.
    const isEdit = !!generatedHtml;
    if (planMode && !isEdit) {
      const plan = await runPlan(next, trimmed);
      if (!plan) {
        // Fallback: just generate
        const html = await generate(next, trimmed);
        if (html) await summarize(next);
        setBusy(false);
      }
      // Leave busy=true; user must approve/skip to continue
      return;
    }

    const html = await generate(next, trimmed);
    if (html) await summarize(next);
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

  const pendingPlanIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.plan && m.plan.status === "pending" && !m.plan.loading) return i;
    }
    return -1;
  })();

  const resetAll = () => {
    stop();
    setMessages(STARTER);
    setGeneratedHtml("");
    setLiveHtml("");
    setVersions([]);
    setActiveVersionId(null);
    setProjectName("Untitled project");
    setDeployments([]);
  };

  const onPublish = (meta: { title: string; description: string; subdomain: string }) => {
    const version = deployments.length + 1;
    const url = `https://${meta.subdomain}.breezy.app`;
    const d: Deployment = {
      id: crypto.randomUUID(),
      version,
      url,
      title: meta.title,
      createdAt: Date.now(),
    };
    setDeployments((prev) => [d, ...prev]);
    setLiveHtml(generatedHtml);
    toast.success("Published 🚀", { description: url });
  };

  const displayedHtml = previewMode === "live" ? liveHtml : generatedHtml;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Toaster position="top-center" />
      <BuilderTopBar
        projectName={projectName}
        setProjectName={setProjectName}
        versionCount={versions.length}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        hasLive={!!liveHtml}
        onOpenPublish={() => setPublishOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="flex-1 grid grid-cols-[56px_minmax(0,1fr)_minmax(340px,400px)] min-h-0 min-w-0">
        {/* Icon rail */}
        <IconRail
          active={activePanel}
          setActive={setActivePanel}
          onOpenConnectors={() => setConnectorsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          versionCount={versions.length}
          connectedCount={activeConnectorNames.length}
        />

        {/* Center canvas */}
        <section className="flex flex-col min-h-0 min-w-0 border-r border-border">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 bg-card/40 min-w-0 overflow-x-auto">
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
                disabled={!displayedHtml}
                onClick={() => {
                  navigator.clipboard.writeText(displayedHtml);
                  toast.success("HTML copied");
                }}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted disabled:opacity-40"
                title="Copy HTML"
              >
                <Copy className="size-3.5" /> Copy
              </button>
              <button
                disabled={!displayedHtml}
                onClick={() => {
                  const blob = new Blob([displayedHtml], { type: "text/html" });
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
              <button
                disabled={!displayedHtml}
                onClick={() => {
                  const blob = new Blob([displayedHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                  setTimeout(() => URL.revokeObjectURL(url), 30000);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted disabled:opacity-40"
                title="Open in new tab"
              >
                <ExternalLink className="size-3.5" /> Open
              </button>
              <button
                disabled={!deployments[0]}
                onClick={() => {
                  if (!deployments[0]) return;
                  navigator.clipboard.writeText(deployments[0].url);
                  toast.success("Live URL copied");
                }}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted disabled:opacity-40"
                title="Share live URL"
              >
                <Share2 className="size-3.5" /> Share
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-muted/30 via-background to-muted/30">
            {view === "preview" ? (
              <PreviewCanvas device={device} html={displayedHtml} build={lastBuild} mode={previewMode} />
            ) : (
              <CodeView html={displayedHtml} />
            )}
          </div>
        </section>

        {/* Right side: chat / history / connectors-inline / settings */}
        <aside className="flex flex-col bg-card/40 min-h-0 min-w-0">
          {activePanel === "history" ? (
            <HistoryPanel
              versions={versions}
              activeVersionId={activeVersionId}
              onSelect={(v) => {
                setGeneratedHtml(v.html);
                setActiveVersionId(v.id);
                toast.success(`Restored to v${versions.findIndex((x) => x.id === v.id) + 1}`);
              }}
            />
          ) : (
            <>
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Conversation</span>
                </div>
                <button
                  onClick={resetAll}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-muted"
                >
                  <Plus className="size-3.5" /> New
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-4 min-w-0">
                {messages.map((m, i) => (
                  <Message
                    key={i}
                    msg={m}
                    onApprovePlan={
                      i === pendingPlanIdx && m.role === "assistant" && m.plan
                        ? () => {
                            const hist = messages.slice(0, i);
                            approvePlan(hist, m.plan!.userPrompt);
                          }
                        : undefined
                    }
                    onSkipPlan={
                      i === pendingPlanIdx && m.role === "assistant" && m.plan ? skipPlan : undefined
                    }
                  />
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
                {!busy && generatedHtml && messages.length > 1 && pendingPlanIdx === -1 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {[
                      "Make it darker and more premium",
                      "Add a testimonials section",
                      "Try a different color palette",
                      "Make the hero more bold",
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
                {activeConnectorNames.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground">Context:</span>
                    {activeConnectorNames.slice(0, 4).map((n) => (
                      <span key={n} className="px-1.5 py-0.5 rounded-full bg-mint/30 text-ink font-semibold">
                        {n}
                      </span>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex items-end gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 ring-primary/30 transition"
                >
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    rows={1}
                    placeholder={busy ? "Breezy is working…" : planMode ? "Describe your idea — I'll plan first…" : "Describe a change…"}
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
                <div className="flex items-center justify-between mt-2 px-1">
                  <button
                    onClick={() => setPlanMode((p) => !p)}
                    className={`text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition ${planMode ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"}`}
                    title="Toggle Plan mode (⌘P)"
                  >
                    <Wand2 className="size-3" /> Plan mode {planMode ? "on" : "off"}
                  </button>
                  <p className="text-[11px] text-muted-foreground">⌘+/ to focus · Shift+↵ newline</p>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <ConnectorsPanel
        open={connectorsOpen}
        onOpenChange={setConnectorsOpen}
        connections={connections}
        setConnections={setConnections}
      />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        projectName={projectName}
        generatedHtml={generatedHtml}
        deployments={deployments}
        onPublish={onPublish}
      />
      <ProjectSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectName={projectName}
        setProjectName={setProjectName}
        onReset={resetAll}
      />
    </div>
  );
}

function IconRail({
  active,
  setActive,
  onOpenConnectors,
  onOpenSettings,
  versionCount,
  connectedCount,
}: {
  active: ActivePanel;
  setActive: (p: ActivePanel) => void;
  onOpenConnectors: () => void;
  onOpenSettings: () => void;
  versionCount: number;
  connectedCount: number;
}) {
  const items = [
    { id: "chat" as const, Icon: MessageSquare, label: "Chat", badge: null as ReactNode },
    {
      id: "history" as const,
      Icon: History,
      label: "History",
      badge: versionCount > 0 ? versionCount : null,
    },
  ];
  return (
    <div className="bg-ink text-cream/80 flex flex-col items-center py-3 gap-1 border-r border-border">
      {items.map(({ id, Icon, label, badge }) => (
        <button
          key={id}
          onClick={() => setActive(id)}
          title={label}
          className={`relative size-10 rounded-xl grid place-items-center transition ${
            active === id ? "bg-cream/15 text-cream" : "hover:bg-cream/10"
          }`}
        >
          <Icon className="size-4" />
          {badge != null && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground grid place-items-center">
              {badge}
            </span>
          )}
        </button>
      ))}
      <button
        onClick={onOpenConnectors}
        title="Connectors"
        className="relative size-10 rounded-xl grid place-items-center hover:bg-cream/10 transition"
      >
        <Plug className="size-4" />
        {connectedCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-mint text-[9px] font-bold text-ink grid place-items-center">
            {connectedCount}
          </span>
        )}
      </button>

      <div className="mt-auto flex flex-col gap-1">
        <button
          onClick={onOpenSettings}
          title="Project settings"
          className="size-10 rounded-xl grid place-items-center hover:bg-cream/10 transition"
        >
          <SettingsIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

function HistoryPanel({
  versions,
  activeVersionId,
  onSelect,
}: {
  versions: Version[];
  activeVersionId: string | null;
  onSelect: (v: Version) => void;
}) {
  return (
    <>
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <History className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">History</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{versions.length} versions</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {versions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10">
            Versions appear here after each build.
          </p>
        )}
        {versions
          .slice()
          .reverse()
          .map((v, idx) => {
            const realIdx = versions.length - idx;
            const active = v.id === activeVersionId;
            return (
              <button
                key={v.id}
                onClick={() => onSelect(v)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition flex items-center gap-2.5 ${
                  active ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div className={`size-7 rounded-md grid place-items-center text-[10px] font-mono shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  v{realIdx}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{v.prompt || "Update"}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                {active ? (
                  <Check className="size-3.5 text-primary shrink-0" />
                ) : (
                  <RotateCcw className="size-3 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
      </div>
    </>
  );
}

function BuilderTopBar({
  projectName,
  setProjectName,
  versionCount,
  previewMode,
  setPreviewMode,
  hasLive,
  onOpenPublish,
  onOpenSettings,
}: {
  projectName: string;
  setProjectName: (n: string) => void;
  versionCount: number;
  previewMode: "preview" | "live";
  setPreviewMode: (m: "preview" | "live") => void;
  hasLive: boolean;
  onOpenPublish: () => void;
  onOpenSettings: () => void;
}) {
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
      <button
        onClick={onOpenSettings}
        className="group inline-flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-md hover:bg-muted transition"
        title="Open project settings"
      >
        {projectName}
        <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
      </button>
      {versionCount > 0 && (
        <span className="text-[11px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted">
          v{versionCount}
        </span>
      )}

      {/* Live / Preview toggle */}
      {hasLive && (
        <div className="ml-3 inline-flex rounded-full bg-muted p-0.5 text-[11px] font-semibold">
          <button
            onClick={() => setPreviewMode("preview")}
            className={`px-2.5 py-1 rounded-full transition ${previewMode === "preview" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
          >
            Preview
          </button>
          <button
            onClick={() => setPreviewMode("live")}
            className={`px-2.5 py-1 rounded-full transition inline-flex items-center gap-1 ${previewMode === "live" ? "bg-card shadow-soft" : "text-muted-foreground"}`}
          >
            <span className="size-1.5 rounded-full bg-mint animate-pulse" /> Live
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-mint animate-pulse" /> Auto-saved
        </span>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="hidden"
          aria-hidden
        />
        <button
          onClick={onOpenPublish}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-ink text-cream hover:scale-[1.03] transition"
          title="Publish (⌘⇧P)"
        >
          {hasLive ? <Globe className="size-3.5" /> : <Rocket className="size-3.5" />} {hasLive ? "Update" : "Publish"}
        </button>
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
    else if (m[3])
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-card text-[12px] font-mono">
          {m[3]}
        </code>,
      );
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
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
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
  const activeIdx = Math.min(steps.length - 1, build.phaseIndex ?? Math.floor((build.progress / 100) * steps.length));
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 w-full transition-opacity duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            {!build.done && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            )}
            <span
              className={`relative inline-flex rounded-full size-2 ${build.done ? (build.error ? "bg-rose" : "bg-mint") : "bg-primary"}`}
            />
          </span>
          <span className="text-sm font-semibold transition-all duration-300">
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

      {/* Phase list — driven by streamed HTML phase index */}
      <ul className="space-y-1.5 pt-1">
        {steps.map((s, i) => {
          const label = s.label;
          const done = build.done ? !build.error : i < activeIdx;
          const active = !build.done && i === activeIdx;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 text-xs transition-all duration-300 ease-out ${
                active ? "opacity-100 translate-x-0" : done ? "opacity-70" : "opacity-50"
              }`}
            >
              <span
                className={`size-4 rounded-full grid place-items-center shrink-0 transition-colors duration-300 ${
                  done
                    ? "bg-mint text-ink"
                    : active
                      ? "bg-primary/15 text-primary ring-2 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? (
                  <Check className="size-2.5" strokeWidth={3} />
                ) : active ? (
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                ) : (
                  <span className="size-1 rounded-full bg-muted-foreground/40" />
                )}
              </span>
              <span
                className={`transition-colors duration-300 ${
                  done
                    ? "text-muted-foreground line-through decoration-muted-foreground/40"
                    : active
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                }`}
              >
                {active ? `${label}…` : label}
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
          <div className="ml-3 text-xs text-muted-foreground font-mono flex-1 truncate">untitled.breezy.app</div>
          {generating && (
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 transition-opacity duration-300">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              <span key={build?.phase} className="transition-opacity duration-300">
                {build?.phase} · {build?.progress}%
              </span>
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
            ? "Designing your site now. I’ll only show it once the full page is finished and verified."
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
