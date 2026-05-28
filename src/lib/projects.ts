// Multi-project storage. Each project's state lives at
// `breezy.project.v2:<id>` and a lightweight index of all projects lives at
// `breezy.projects.index.v1`.

export type ProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  thumbnail?: string; // first ~200 chars of body or a snippet for the card
  hasHtml: boolean;
};

const INDEX_KEY = "breezy.projects.index.v1";
export const PROJECT_STORAGE_PREFIX = "breezy.project.v2:";
const LEGACY_KEY = "breezy.project.v1";
const LEGACY_ID_KEY = "breezy.projectId.v1";

export function projectStorageKey(id: string) {
  return `${PROJECT_STORAGE_PREFIX}${id}`;
}

export function listProjects(): ProjectMeta[] {
  if (typeof window === "undefined") return [];
  migrateLegacyIfNeeded();
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ProjectMeta[];
    return [...arr].sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function upsertProjectMeta(meta: ProjectMeta) {
  if (typeof window === "undefined") return;
  const all = listProjects().filter((p) => p.id !== meta.id);
  all.unshift(meta);
  localStorage.setItem(INDEX_KEY, JSON.stringify(all));
}

export function deleteProject(id: string) {
  if (typeof window === "undefined") return;
  const all = listProjects().filter((p) => p.id !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(all));
  localStorage.removeItem(projectStorageKey(id));
}

export function newProjectId(): string {
  return crypto.randomUUID();
}

// Migrate the old single-project storage into the new index on first read.
function migrateLegacyIfNeeded() {
  try {
    if (localStorage.getItem(INDEX_KEY)) return;
    const legacy = localStorage.getItem(LEGACY_KEY);
    const legacyId = localStorage.getItem(LEGACY_ID_KEY) || newProjectId();
    if (!legacy) {
      localStorage.setItem(INDEX_KEY, JSON.stringify([]));
      return;
    }
    const data = JSON.parse(legacy);
    localStorage.setItem(projectStorageKey(legacyId), legacy);
    const meta: ProjectMeta = {
      id: legacyId,
      name: data.name || "Untitled project",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hasHtml: Array.isArray(data.versions) && data.versions.length > 0,
    };
    localStorage.setItem(INDEX_KEY, JSON.stringify([meta]));
  } catch {
    /* ignore */
  }
}
