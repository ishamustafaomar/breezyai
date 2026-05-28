import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Sparkles, ArrowRight, LogOut } from "lucide-react";
import { listProjects, deleteProject, newProjectId, type ProjectMeta } from "@/lib/projects";
import { useAuth } from "@/hooks/use-auth";
import { BreezyLogo } from "@/components/breezy-logo";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your projects — Breezy" },
      { name: "description", content: "All your Breezy projects in one place." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);

  useEffect(() => {
    setProjects(listProjects());
  }, []);

  const createNew = () => {
    const id = newProjectId();
    navigate({ to: "/app", search: { id } });
  };

  const onDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    deleteProject(id);
    setProjects(listProjects());
    toast.success("Project deleted");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <Toaster position="top-center" />
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/70 sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <BreezyLogo className="size-9 group-hover:rotate-6 transition-transform" />
            <span className="font-display text-xl font-bold tracking-tight">breezy</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground max-w-[200px] truncate">
              {user?.email}
            </span>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Your projects</h1>
            <p className="text-muted-foreground mt-1.5">
              {projects.length === 0
                ? "Start your first vibe-coded project."
                : `${projects.length} project${projects.length === 1 ? "" : "s"} so far.`}
            </p>
          </div>
          <button
            onClick={createNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink text-cream font-semibold text-sm shadow-soft hover:bg-ink/90 hover:scale-[1.03] transition-all"
          >
            <Plus className="size-4" /> New project
          </button>
        </div>

        {projects.length === 0 ? (
          <button
            onClick={createNew}
            className="w-full grid place-items-center text-center py-24 rounded-3xl border-2 border-dashed border-border bg-card/40 hover:bg-card/70 hover:border-primary/60 transition-colors group"
          >
            <div className="space-y-4">
              <BreezyLogo className="size-16 mx-auto group-hover:rotate-6 transition-transform" />
              <div className="font-display text-2xl font-bold">Build your first project</div>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Describe what you want, watch Breezy design it live, and ship it in minutes.
              </p>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Start building <ArrowRight className="size-4" />
              </div>
            </div>
          </button>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={createNew}
              className="group min-h-[200px] rounded-2xl border-2 border-dashed border-border bg-card/40 hover:bg-card/70 hover:border-primary/60 transition-all grid place-items-center text-center p-6"
            >
              <div className="space-y-2">
                <div className="size-12 mx-auto rounded-2xl bg-gradient-warm grid place-items-center shadow-soft group-hover:rotate-6 transition-transform">
                  <Plus className="size-5 text-ink" strokeWidth={2.5} />
                </div>
                <div className="font-semibold">New project</div>
                <p className="text-xs text-muted-foreground">Start fresh</p>
              </div>
            </button>
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/app"
                search={{ id: p.id }}
                className="group min-h-[200px] rounded-2xl border border-border bg-card hover:shadow-soft hover:border-primary/40 transition-all overflow-hidden flex flex-col"
              >
                <div className="flex-1 bg-gradient-hero relative grain p-5 flex items-start justify-between">
                  <BreezyLogo className="size-10" />
                  <button
                    onClick={(e) => onDelete(e, p.id, p.name)}
                    className="opacity-0 group-hover:opacity-100 size-8 grid place-items-center rounded-full bg-background/80 backdrop-blur hover:bg-destructive hover:text-destructive-foreground transition-all"
                    title="Delete project"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="p-5 border-t border-border">
                  <div className="font-semibold truncate flex items-center gap-1.5">
                    {p.name}
                    {p.hasHtml && <Sparkles className="size-3.5 text-primary shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatRelative(p.updatedAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
