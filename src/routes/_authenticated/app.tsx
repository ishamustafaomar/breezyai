import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { BreezyLogo } from "@/components/breezy-logo";
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
  Plug,
  Keyboard,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Github,
  CreditCard,
  Database,
  Mail,
  BarChart3,
  Cloud,
  MessageSquare,
  Image as ImageIcon,
  Webhook,
  Globe,
  Bot,
  Slack,
} from "lucide-react";
import { streamChat } from "@/lib/chat-stream";
import { Toaster } from "@/components/ui/sonner";
import { CustomDomainDialog } from "@/components/custom-domain-dialog";
import { projectStorageKey, upsertProjectMeta, newProjectId, type ProjectMeta } from "@/lib/projects";

const PUBLISHED_KEY = "breezy.published.v1";


const SLASH_COMMANDS = [
  { cmd: "/dark", desc: "Switch to a dark theme", prompt: "Redesign with a dark, premium theme — deep backgrounds, vivid accents." },
  { cmd: "/light", desc: "Switch to a light theme", prompt: "Redesign with a clean, light, airy theme." },
  { cmd: "/bold", desc: "Make the design bolder", prompt: "Make the hero and typography dramatically bolder and more confident." },
  { cmd: "/minimal", desc: "Strip back to minimal", prompt: "Simplify to a minimal, editorial layout with lots of whitespace." },
  { cmd: "/testimonials", desc: "Add testimonials", prompt: "Add a testimonials section with 3 quotes and author avatars." },
  { cmd: "/pricing", desc: "Add pricing tiers", prompt: "Add a 3-tier pricing section with a recommended plan." },
  { cmd: "/faq", desc: "Add an FAQ", prompt: "Add an accordion FAQ section with 5 common questions." },
  { cmd: "/footer", desc: "Add a rich footer", prompt: "Add a rich multi-column footer with links, social icons, and a newsletter signup." },
  { cmd: "/clear", desc: "Start a fresh project", prompt: "__CLEAR__" },
];

type ApiKeyConnector = { id: string; name: string; desc: string; Icon: typeof Github; envHint: string };
const API_KEY_CONNECTORS: ApiKeyConnector[] = [
  { id: "openai", name: "OpenAI", desc: "GPT models, embeddings, DALL·E", Icon: Bot, envHint: "OPENAI_API_KEY" },
  { id: "anthropic", name: "Anthropic", desc: "Claude models", Icon: Bot, envHint: "ANTHROPIC_API_KEY" },
  { id: "elevenlabs", name: "ElevenLabs", desc: "AI voices & text-to-speech", Icon: MessageSquare, envHint: "ELEVENLABS_API_KEY" },
  { id: "replicate", name: "Replicate", desc: "Run any open-source model", Icon: ImageIcon, envHint: "REPLICATE_API_TOKEN" },
  { id: "stripe", name: "Stripe", desc: "Payments & subscriptions", Icon: CreditCard, envHint: "STRIPE_SECRET_KEY" },
  { id: "resend", name: "Resend", desc: "Transactional email", Icon: Mail, envHint: "RESEND_API_KEY" },
  { id: "posthog", name: "PostHog", desc: "Product analytics", Icon: BarChart3, envHint: "POSTHOG_API_KEY" },
  { id: "supabase", name: "Supabase", desc: "Database service key", Icon: Database, envHint: "SUPABASE_SERVICE_ROLE" },
  { id: "openrouter", name: "OpenRouter", desc: "Multi-model AI router", Icon: Bot, envHint: "OPENROUTER_API_KEY" },
  { id: "groq", name: "Groq", desc: "Ultra-fast LLM inference", Icon: Bot, envHint: "GROQ_API_KEY" },
  { id: "cloudflare", name: "Cloudflare", desc: "Workers, R2, KV", Icon: Cloud, envHint: "CLOUDFLARE_API_TOKEN" },
  { id: "slack", name: "Slack Webhook", desc: "Post to a channel", Icon: Slack, envHint: "SLACK_WEBHOOK_URL" },
];

const CREDIT_KEY = "breezy.credits.v1";
const DAILY_CREDITS = 5;
const PRO_KEY = "breezy.pro.v1";
const KEYS_STORAGE = "breezy.apikeys.v1";

function getCreditState(): { date: string; used: number } {
  if (typeof window === "undefined") return { date: "", used: 0 };
  try {
    const raw = localStorage.getItem(CREDIT_KEY);
    const today = new Date().toISOString().slice(0, 10);
    if (!raw) return { date: today, used: 0 };
    const p = JSON.parse(raw);
    if (p.date !== today) return { date: today, used: 0 };
    return p;
  } catch {
    return { date: new Date().toISOString().slice(0, 10), used: 0 };
  }
}
function bumpCredit(): { used: number; remaining: number } {
  const s = getCreditState();
  s.used += 1;
  localStorage.setItem(CREDIT_KEY, JSON.stringify(s));
  return { used: s.used, remaining: Math.max(0, DAILY_CREDITS - s.used) };
}
function isPro(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PRO_KEY) === "1";
}


function fireConfetti() {
  const duration = 1500;
  const end = Date.now() + duration;
  const colors = ["#f97316", "#fb923c", "#fde68a", "#34d399", "#60a5fa"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.8 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.8 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" && s.id.length > 0 ? s.id : undefined,
  }),
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
  mode?: "build" | "edit";
};

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; build?: BuildStatus; clarify?: string[] };


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

// Edit-mode shows a different, much shorter phase list — it's a surgical patch, not a rebuild.
const EDIT_PHASES: { id: string; label: string }[] = [
  { id: "read", label: "Reading current site" },
  { id: "locate", label: "Locating the change" },
  { id: "apply", label: "Applying edits" },
  { id: "review", label: "Reviewing & verifying" },
];
const EDIT_PHASE_LABELS = EDIT_PHASES.map((p) => p.label);

const CLARIFY_MARKER_RE = /<!--BREEZY_CLARIFY:(.*?)-->/;


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

function BuilderApp() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  // If no project id in URL, mint one and replace the URL so this tab is
  // bound to a single project (and reload preserves it).
  const [projectId] = useState<string>(() => search.id ?? newProjectId());
  useEffect(() => {
    if (!search.id) {
      navigate({ to: "/app", search: { id: projectId }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [createdAt] = useState<number>(() => Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydratedRef = useRef(false);
  const createdAtRef = useRef<number>(createdAt);

  // Hydrate this project's state from localStorage on mount
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(projectStorageKey(projectId));
      if (!raw) return;
      const data = JSON.parse(raw) as {
        messages?: Msg[];
        versions?: Version[];
        activeVersionId?: string;
        name?: string;
        createdAt?: number;
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
      if (data.createdAt) createdAtRef.current = data.createdAt;
    } catch {
      /* ignore */
    }
  }, [projectId]);

  // Persist this project + bump the projects index on change
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        projectStorageKey(projectId),
        JSON.stringify({ messages, versions, activeVersionId, name: projectName, createdAt: createdAtRef.current }),
      );
      const meta: ProjectMeta = {
        id: projectId,
        name: projectName,
        createdAt: createdAtRef.current,
        updatedAt: Date.now(),
        hasHtml: versions.length > 0,
      };
      upsertProjectMeta(meta);
    } catch {
      /* quota: ignore */
    }
  }, [messages, versions, activeVersionId, projectName, projectId]);



  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((s) => !s);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setConnectorsOpen((s) => !s);
      } else if (mod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((s) => !s);
      } else if (e.key === "Escape") {
        setSlashOpen(false);
        setConnectorsOpen(false);
        setShortcutsOpen(false);
        if (busy) {
          abortRef.current?.abort();
          genAbortRef.current?.abort();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [busy]);

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

  const generate = async (history: Msg[], userPrompt: string) => {
    genAbortRef.current?.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;
    startPhaseTicker();

    const baseHtml = generatedHtml; // edit base — preserved if request fails
    const isEdit = !!(baseHtml && baseHtml.length > 200);
    const phaseList = isEdit ? EDIT_PHASE_LABELS : PHASE_LABELS;
    patchBuild({ mode: isEdit ? "edit" : "build", phase: phaseList[0], phaseIndex: 0, progress: 4 });

    const doFetch = () =>
      fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content })),
          currentHtml: baseHtml || undefined,
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
        patchBuild({
          done: true,
          error: error || "Generation failed",
          progress: 100,
          phase: "Failed",
          phaseIndex: phaseList.length - 1,
        });
        return null;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let html = "";
      const TARGET = isEdit ? Math.max(8000, baseHtml.length) : 22000;
      let lastPreviewLen = 0;
      phaseIdxRef.current = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });

        if (isEdit) {
          // Edit-mode phases are time/length-based, not regex-based.
          const ratio = html.length / TARGET;
          let pIdx = 0;
          if (ratio > 0.05) pIdx = 1;
          if (ratio > 0.35) pIdx = 2;
          if (ratio > 0.85 || html.toLowerCase().includes("</html>")) pIdx = 3;
          phaseIdxRef.current = Math.max(phaseIdxRef.current, pIdx);
          const pct = Math.min(96, Math.round(ratio * 92));
          patchBuild({ progress: pct, phase: EDIT_PHASE_LABELS[phaseIdxRef.current], phaseIndex: phaseIdxRef.current });
        } else {
          const detected = detectPhase(html);
          phaseIdxRef.current = Math.max(phaseIdxRef.current, detected);
          const phaseIdx = phaseIdxRef.current;
          const pct = progressFromPhase(phaseIdx, html.length, TARGET);
          patchBuild({ progress: pct, phase: PHASE_LABELS[phaseIdx], phaseIndex: phaseIdx });
        }

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

      // Clarify-mode response: no HTML, just questions.
      const clarifyMatch = html.match(CLARIFY_MARKER_RE);
      if (clarifyMatch && !html.toLowerCase().includes("<!doctype")) {
        setGeneratedHtml(baseHtml);
        const questions = clarifyMatch[1].split("|").map((q) => q.trim()).filter(Boolean);
        patchBuild({
          done: true,
          progress: 100,
          phase: "Need a bit more info",
          phaseIndex: phaseList.length - 1,
        });
        // Replace the last assistant message content with the clarify questions
        setMessages((prev) => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "assistant" && (copy[i] as Extract<Msg, { role: "assistant" }>).build) {
              copy[i] = {
                role: "assistant",
                content: "A couple quick questions so I can build this right:",
                clarify: questions,
              };
              break;
            }
          }
          return copy;
        });
        return null;
      }

      patchBuild({
        phase: isEdit ? "Reviewing & verifying" : "Verifying completion",
        phaseIndex: phaseList.length - 1,
        progress: 98,
      });
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
        patchBuild({
          done: true,
          error,
          progress: 98,
          phase: "Incomplete",
          phaseIndex: phaseIdxRef.current,
        });
        return null;
      }
      setGeneratedHtml(html);
      const v: Version = {
        id: crypto.randomUUID(),
        html,
        prompt: userPrompt,
        createdAt: Date.now(),
      };
      setVersions((prev) => [...prev, v]);
      setActiveVersionId(v.id);
      patchBuild({
        progress: 100,
        phase: isEdit ? "Edit applied" : "Finished and verified",
        phaseIndex: phaseList.length - 1,
        done: true,
      });
      return html;

    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error((e as Error).message || "Generation failed");
        patchBuild({
          done: true,
          error: (e as Error).message,
          progress: 100,
          phase: "Failed",
          phaseIndex: phaseIdxRef.current,
        });
      } else {
        patchBuild({
          done: true,
          error: "Build stopped before completion.",
          phase: "Stopped",
          phaseIndex: phaseIdxRef.current,
        });
      }
      return null;
    } finally {
      stopPhaseTicker();
    }
  };

  const clearProject = useCallback(() => {
    stopPhaseTicker();
    abortRef.current?.abort();
    genAbortRef.current?.abort();
    setMessages(STARTER);
    setGeneratedHtml("");
    setVersions([]);
    setActiveVersionId(null);
    setShowHistory(false);
    setProjectName("Untitled project");
    setBusy(false);
    toast.success("Started a fresh project");
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    // Slash commands
    if (trimmed.startsWith("/")) {
      const cmd = SLASH_COMMANDS.find((c) => c.cmd === trimmed.split(/\s+/)[0].toLowerCase());
      if (cmd) {
        setSlashOpen(false);
        if (cmd.prompt === "__CLEAR__") {
          clearProject();
          setInput("");
          return;
        }
        return send(cmd.prompt);
      }
    }

    const userMsg: Msg = { role: "user", content: trimmed };
    const buildMsg: Msg = {
      role: "assistant",
      content: "",
      build: { phase: PHASE_LABELS[0], phaseIndex: 0, progress: 3, done: false },
    };
    const next = [...messages, userMsg];
    setMessages([...next, buildMsg]);
    setInput("");
    setBusy(true);

    // 1) Generate site (with live progress)
    const html = await generate(next, trimmed);

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
      <BuilderTopBar
        projectName={projectName}
        setProjectName={setProjectName}
        versionCount={versions.length}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((s) => !s)}
        onOpenConnectors={() => setConnectorsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <div className={`flex-1 grid min-h-0 ${sidebarOpen ? "lg:grid-cols-[400px_1fr]" : "lg:grid-cols-[0_1fr]"}`}>
        {/* Chat */}
        <aside className={`flex flex-col border-r border-border bg-card/40 min-h-0 ${sidebarOpen ? "" : "hidden"}`}>
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Conversation</span>
            </div>
            <div className="flex items-center gap-1">
              {versions.length > 0 && (
                <button
                  onClick={() => setShowHistory((s) => !s)}
                  className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full transition ${showHistory ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  title="Version history"
                >
                  <History className="size-3.5" /> v{versions.length}
                </button>
              )}
              <button
                onClick={clearProject}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-muted"
              >
                <Plus className="size-3.5" /> New
              </button>
            </div>
          </div>

          {showHistory && versions.length > 0 && (
            <div className="border-b border-border bg-background/60 max-h-56 overflow-y-auto p-3 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pb-1">Versions</p>
              {versions
                .slice()
                .reverse()
                .map((v, idx) => {
                  const realIdx = versions.length - idx;
                  const active = v.id === activeVersionId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setGeneratedHtml(v.html);
                        setActiveVersionId(v.id);
                        toast.success(`Restored version ${realIdx}`);
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition flex items-center gap-2 ${active ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-muted"}`}
                    >
                      <div
                        className={`size-6 rounded-md grid place-items-center text-[10px] font-mono shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        v{realIdx}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{v.prompt || "Update"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(v.createdAt).toLocaleTimeString()}
                        </p>
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
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((m, i) => (
              <Message key={i} msg={m} onChip={(t) => send(t)} />

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

          <div className="p-4 border-t border-border bg-background/60 relative">
            {slashOpen && (
              <div className="absolute left-4 right-4 bottom-full mb-2 rounded-2xl border border-border bg-popover shadow-elegant overflow-hidden animate-fade-in z-10">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1">Slash commands</p>
                <ul className="max-h-64 overflow-y-auto pb-1">
                  {SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input.split(/\s+/)[0].toLowerCase())).map((c) => (
                    <li key={c.cmd}>
                      <button
                        type="button"
                        onClick={() => {
                          setInput("");
                          setSlashOpen(false);
                          send(c.cmd);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-3"
                      >
                        <code className="text-xs font-mono text-primary">{c.cmd}</code>
                        <span className="text-xs text-muted-foreground">{c.desc}</span>
                      </button>
                    </li>
                  ))}
                </ul>
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
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setSlashOpen(e.target.value.startsWith("/"));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={busy ? "Breezy is building…" : "Describe a change… (try / for commands)"}
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
            <p className="text-[11px] text-muted-foreground mt-2 px-1 flex items-center justify-between">
              <span>Shift + Enter for new line · ⌘K to focus</span>
              <button onClick={() => setShortcutsOpen(true)} className="hover:text-foreground inline-flex items-center gap-1">
                <Keyboard className="size-3" /> shortcuts
              </button>
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
              <button
                disabled={!generatedHtml}
                onClick={() => {
                  const blob = new Blob([generatedHtml], { type: "text/html" });
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
                disabled={!generatedHtml}
                onClick={async () => {
                  try {
                    const dataUrl =
                      "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(generatedHtml)));
                    if (navigator.share) {
                      await navigator
                        .share({
                          title: projectName,
                          text: "Check out what I made with Breezy",
                          url: dataUrl,
                        })
                        .catch(() => {});
                    } else {
                      await navigator.clipboard.writeText(dataUrl);
                      toast.success("Share link copied — paste it anywhere");
                    }
                  } catch {
                    toast.error("Couldn't create a share link");
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted disabled:opacity-40"
                title="Copy a self-contained share link"
              >
                <Share2 className="size-3.5" /> Share
              </button>
              <button
                disabled={!generatedHtml}
                onClick={async () => {
                  try {
                    const blob = new Blob([generatedHtml], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                    const dataUrl =
                      "data:text/html;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(generatedHtml)));
                    await navigator.clipboard.writeText(dataUrl).catch(() => {});
                    const firstTime = !localStorage.getItem(PUBLISHED_KEY);
                    if (firstTime) {
                      localStorage.setItem(PUBLISHED_KEY, String(Date.now()));
                      fireConfetti();
                      toast.success("🎉 First publish! Site opened in a new tab", {
                        description: "Share link copied. For a real custom domain, publish from the Lovable workspace.",
                      });
                    } else {
                      toast.success("Site opened in a new tab — share link copied", {
                        description:
                          "Paste anywhere to share. For a real custom domain, publish from the Lovable workspace.",
                      });
                    }
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  } catch {
                    toast.error("Couldn't publish the preview");
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-ink text-cream hover:scale-[1.03] transition disabled:opacity-40"
                title="Open the site and copy a share link"
              >
                <Rocket className="size-3.5" /> Publish
              </button>
              <button
                onClick={() => setDomainOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Connect a custom domain"
              >
                <Globe className="size-3.5" /> Domain
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-muted/30 via-background to-muted/30">
            {view === "preview" ? (
              <PreviewCanvas device={device} html={generatedHtml} build={lastBuild} />
            ) : (
              <CodeView html={generatedHtml} />
            )}
          </div>
        </section>
      </div>
      {connectorsOpen && <ConnectorsDialog onClose={() => setConnectorsOpen(false)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {domainOpen && <CustomDomainDialog projectId={projectId} onClose={() => setDomainOpen(false)} />}
    </div>
  );
}

function BuilderTopBar({
  projectName,
  setProjectName,
  versionCount,
  sidebarOpen,
  onToggleSidebar,
  onOpenConnectors,
  onOpenShortcuts,
}: {
  projectName: string;
  setProjectName: (n: string) => void;
  versionCount: number;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenConnectors: () => void;
  onOpenShortcuts: () => void;
}) {
  return (
    <div className="h-14 border-b border-border bg-card/60 backdrop-blur flex items-center px-4 gap-3 shrink-0">
      <button
        onClick={onToggleSidebar}
        className="size-8 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground"
        title={sidebarOpen ? "Hide chat (⌘B)" : "Show chat (⌘B)"}
      >
        {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
      </button>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Back
      </Link>
      <div className="size-6 w-px bg-border" />
      <Link to="/" className="flex items-center gap-2">
        <BreezyLogo className="size-8" />
        <span className="font-display font-bold">breezy</span>
      </Link>

      <div className="size-6 w-px bg-border" />
      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="bg-transparent text-sm font-medium outline-none focus:bg-muted px-2 py-1 rounded-md max-w-[220px]"
      />
      {versionCount > 0 && (
        <span className="text-[11px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted">
          v{versionCount}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpenConnectors}
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Connectors (⌘⇧P)"
        >
          <Plug className="size-3.5" /> Connectors
        </button>
        <button
          onClick={onOpenShortcuts}
          className="size-8 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
          title="Keyboard shortcuts (⌘/)"
        >
          <Keyboard className="size-4" />
        </button>
        <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-mint animate-pulse" /> Auto-saved
        </span>
        <div className="size-8 rounded-full bg-gradient-cool border-2 border-background" />
      </div>
    </div>
  );
}

function Avatar() {
  return <BreezyLogo className="shrink-0 size-8" />;
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
  const steps = build.mode === "edit" ? EDIT_PHASES : PHASES;
  const activeIdx = Math.min(steps.length - 1, build.phaseIndex ?? Math.floor((build.progress / 100) * steps.length));
  const title = build.done
    ? build.error ? (build.mode === "edit" ? "Edit failed" : "Build failed") : (build.mode === "edit" ? "Edit applied" : "Site ready")
    : (build.mode === "edit" ? "Editing your site" : "Building your site");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 w-full transition-opacity duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            {!build.done && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            )}
          <span className="text-sm font-semibold transition-all duration-300">
            {title}
          </span>

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

function Message({ msg, onChip }: { msg: Msg; onChip?: (text: string) => void }) {
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
        {msg.clarify && msg.clarify.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {msg.clarify.map((q, i) => (
              <button
                key={i}
                onClick={() => onChip?.(q)}
                className="text-xs rounded-full border border-primary/40 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 transition text-foreground"
              >
                {q}
              </button>
            ))}
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
        <BreezyLogo className="mx-auto size-16" />

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

function ConnectorsDialog({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) || "{}"); } catch { return {}; }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const save = (id: string, value: string) => {
    const next = { ...keys };
    if (value.trim()) next[id] = value.trim(); else delete next[id];
    setKeys(next);
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(next));
    setActiveId(null);
    setDraft("");
    toast.success(value.trim() ? "API key saved locally" : "API key removed");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-primary" />
            <h2 className="font-display font-bold text-lg">API Key Connectors</h2>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-full hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs text-muted-foreground">
            Paste an API key from the provider's dashboard. Keys are stored in your browser only and injected into the generated site at build time.
          </p>
        </div>
        <div className="p-6 pt-2 grid sm:grid-cols-2 gap-2">
          {API_KEY_CONNECTORS.map((c) => {
            const has = !!keys[c.id];
            const open = activeId === c.id;
            return (
              <div key={c.id} className={`rounded-2xl border ${has ? "border-mint/40 bg-mint/5" : "border-border bg-background"} px-4 py-3`}>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-muted grid place-items-center text-foreground">
                    <c.Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      {c.name}
                      {has && <Check className="size-3 text-mint" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.desc}</p>
                  </div>
                  <button
                    onClick={() => { setActiveId(open ? null : c.id); setDraft(keys[c.id] || ""); }}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-muted"
                  >
                    {has ? "Edit" : "Add key"}
                  </button>
                </div>
                {open && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={c.envHint}
                      className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-border bg-card outline-none focus:ring-2 ring-primary/30"
                    />
                    <div className="flex gap-2 justify-end">
                      {has && (
                        <button onClick={() => save(c.id, "")} className="text-xs px-3 py-1.5 rounded-full hover:bg-muted text-rose">
                          Remove
                        </button>
                      )}
                      <button onClick={() => save(c.id, draft)} className="text-xs px-3 py-1.5 rounded-full bg-ink text-cream font-semibold">
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const items = [
    { keys: ["⌘", "K"], label: "Focus chat input" },
    { keys: ["⌘", "B"], label: "Toggle sidebar" },
    { keys: ["⌘", "⇧", "P"], label: "Open Connectors" },
    { keys: ["⌘", "/"], label: "Show this dialog" },
    { keys: ["Esc"], label: "Stop generation / close dialogs" },
    { keys: ["/"], label: "Slash command menu in chat" },
    { keys: ["↵"], label: "Send message" },
    { keys: ["⇧", "↵"], label: "New line" },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="size-4 text-primary" />
            <h2 className="font-display font-bold text-lg">Keyboard shortcuts</h2>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-full hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <ul className="p-4 space-y-1">
          {items.map((it) => (
            <li key={it.label} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/50">
              <span className="text-sm">{it.label}</span>
              <span className="flex items-center gap-1">
                {it.keys.map((k) => (
                  <kbd key={k} className="px-2 py-1 rounded-md bg-muted border border-border text-[11px] font-mono">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
