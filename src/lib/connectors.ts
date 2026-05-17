// Connector registry. Tier 1 = functional in UI (stored locally for now,
// will move to DB + AES-GCM credential storage in Phase 2). Tier 2 = shown
// in the catalog with "Coming Soon" badges, mirroring Lovable's pattern.

export type ConnectorAuth = "oauth" | "apikey" | "soon";

export type ConnectorCategory =
  | "Database & Backend"
  | "Payments & Billing"
  | "CMS & Content"
  | "Analytics"
  | "Error Monitoring"
  | "Design"
  | "Productivity"
  | "Project Management"
  | "Automation"
  | "Media & AI"
  | "Experiments";

export type Connector = {
  id: string;
  name: string;
  description: string;
  category: ConnectorCategory;
  tier: 1 | 2;
  auth: ConnectorAuth;
  /** Two-letter mark used as the icon avatar. */
  mark: string;
  /** Tailwind gradient classes for the icon tile. */
  gradient: string;
  /** Short hint shown when chat picks up the connector's context. */
  contextHint?: string;
};

export const CONNECTORS: Connector[] = [
  // ── Tier 1 ────────────────────────────────────────────────────────────
  {
    id: "supabase",
    name: "Supabase",
    description: "Database, auth, storage, and realtime — your full backend.",
    category: "Database & Backend",
    tier: 1,
    auth: "oauth",
    mark: "SB",
    gradient: "from-emerald-400 to-emerald-600",
    contextHint: "Use Supabase for auth, database, and storage when relevant.",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payments, subscriptions, and a hosted customer portal.",
    category: "Payments & Billing",
    tier: 1,
    auth: "oauth",
    mark: "ST",
    gradient: "from-violet-500 to-indigo-600",
    contextHint: "Use Stripe Checkout or Payment Links for any paid flow.",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Sync code, open PRs, and track issues from your repo.",
    category: "Project Management",
    tier: 1,
    auth: "oauth",
    mark: "GH",
    gradient: "from-zinc-700 to-zinc-900",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Reference open issues and create tasks from chat.",
    category: "Project Management",
    tier: 1,
    auth: "oauth",
    mark: "LN",
    gradient: "from-indigo-400 to-violet-600",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Pull in docs and pages as design or copy context.",
    category: "Productivity",
    tier: 1,
    auth: "oauth",
    mark: "NO",
    gradient: "from-zinc-200 to-zinc-400 text-zinc-900",
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Product analytics, session replay, and feature flags.",
    category: "Analytics",
    tier: 1,
    auth: "apikey",
    mark: "PH",
    gradient: "from-orange-400 to-red-500",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Capture errors and performance issues automatically.",
    category: "Error Monitoring",
    tier: 1,
    auth: "apikey",
    mark: "SE",
    gradient: "from-fuchsia-500 to-purple-700",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Import designs and components from a Figma file.",
    category: "Design",
    tier: 1,
    auth: "oauth",
    mark: "FG",
    gradient: "from-pink-400 via-rose-500 to-orange-400",
  },

  // ── Tier 2 (Coming Soon) ──────────────────────────────────────────────
  { id: "firebase", name: "Firebase", description: "Auth and Firestore from Google.", category: "Database & Backend", tier: 2, auth: "soon", mark: "FB", gradient: "from-amber-400 to-orange-600" },
  { id: "polar", name: "Polar", description: "Open-source subscription billing.", category: "Payments & Billing", tier: 2, auth: "soon", mark: "PO", gradient: "from-sky-400 to-blue-600" },
  { id: "sanity", name: "Sanity", description: "Structured-content headless CMS.", category: "CMS & Content", tier: 2, auth: "soon", mark: "SA", gradient: "from-rose-500 to-red-600" },
  { id: "amplitude", name: "Amplitude", description: "Behavioral analytics and A/B tests.", category: "Analytics", tier: 2, auth: "soon", mark: "AM", gradient: "from-blue-500 to-cyan-500" },
  { id: "miro", name: "Miro", description: "Import diagrams and wireframes.", category: "Design", tier: 2, auth: "soon", mark: "MI", gradient: "from-yellow-300 to-amber-500 text-zinc-900" },
  { id: "granola", name: "Granola", description: "Pull in meeting notes as context.", category: "Productivity", tier: 2, auth: "soon", mark: "GR", gradient: "from-lime-400 to-green-600" },
  { id: "atlassian", name: "Atlassian", description: "Jira issues and Confluence docs.", category: "Project Management", tier: 2, auth: "soon", mark: "AT", gradient: "from-blue-500 to-indigo-700" },
  { id: "n8n", name: "n8n", description: "Trigger and run no-code workflows.", category: "Automation", tier: 2, auth: "soon", mark: "N8", gradient: "from-pink-500 to-rose-700" },
  { id: "heygen", name: "HeyGen", description: "AI video generation and avatars.", category: "Media & AI", tier: 2, auth: "soon", mark: "HG", gradient: "from-cyan-400 to-blue-600" },
  { id: "confidence-flags", name: "Confidence Flags", description: "Feature flags and rollouts.", category: "Experiments", tier: 2, auth: "soon", mark: "CF", gradient: "from-teal-400 to-emerald-600" },
  { id: "confidence-exp", name: "Confidence Exp", description: "A/B test management.", category: "Experiments", tier: 2, auth: "soon", mark: "CE", gradient: "from-emerald-400 to-teal-600" },
  { id: "hex", name: "Hex", description: "Data notebooks and analytics.", category: "Experiments", tier: 2, auth: "soon", mark: "HX", gradient: "from-purple-500 to-fuchsia-700" },
];

export const CATEGORIES: ConnectorCategory[] = [
  "Database & Backend",
  "Payments & Billing",
  "CMS & Content",
  "Analytics",
  "Error Monitoring",
  "Design",
  "Productivity",
  "Project Management",
  "Automation",
  "Media & AI",
  "Experiments",
];

// ── Client-side connection store ─────────────────────────────────────────
// Backed by localStorage today. The shape mirrors what we'll persist in
// the `connectors` table later so we can swap the store without changing
// callers.
const STORAGE_KEY = "breezy.connections.v1";

export type Connection = {
  connectorId: string;
  status: "connected" | "disconnected";
  connectedAt: number;
};

export function loadConnections(): Connection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Connection[]) : [];
  } catch {
    return [];
  }
}

export function saveConnections(list: Connection[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export function isConnected(list: Connection[], id: string) {
  return list.some((c) => c.connectorId === id && c.status === "connected");
}

export function connectorContextBlock(list: Connection[]): string {
  const active = CONNECTORS.filter((c) => isConnected(list, c.id) && c.contextHint);
  if (!active.length) return "";
  return [
    "Connected integrations the user can leverage:",
    ...active.map((c) => `- ${c.name}: ${c.contextHint}`),
  ].join("\n");
}
