import { useState } from "react";
import { toast } from "sonner";
import { Rocket, Check, Globe, Copy, ExternalLink, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectName: string;
  generatedHtml: string;
  deployments: Deployment[];
  onPublish: (meta: { title: string; description: string; subdomain: string }) => void;
};

export type Deployment = {
  id: string;
  version: number;
  url: string;
  title: string;
  createdAt: number;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "site";
}

export function PublishDialog({
  open,
  onOpenChange,
  projectName,
  generatedHtml,
  deployments,
  onPublish,
}: Props) {
  const [title, setTitle] = useState(projectName);
  const [description, setDescription] = useState("");
  const [subdomain, setSubdomain] = useState(slugify(projectName));

  const ready = !!generatedHtml && title.trim().length > 0;
  const checks = [
    { ok: !!generatedHtml, label: "Site has been generated" },
    { ok: title.trim().length > 0, label: "SEO title set" },
    { ok: description.trim().length >= 20, label: "Meta description (20+ chars)" },
    { ok: /^[a-z0-9-]+$/.test(subdomain), label: "Valid subdomain (a–z, 0–9, –)" },
  ];

  const live = deployments[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-5" /> Publish
          </DialogTitle>
          <DialogDescription>
            Ship your site to a public URL. You can update or roll back any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Live status */}
          {live ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 flex items-center gap-3">
              <div className="size-8 rounded-lg bg-mint/40 grid place-items-center">
                <Globe className="size-4 text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Currently live · v{live.version}</p>
                <p className="text-sm font-medium truncate">{live.url}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(live.url);
                  toast.success("URL copied");
                }}
                className="size-8 grid place-items-center rounded-lg hover:bg-card"
                title="Copy"
              >
                <Copy className="size-3.5" />
              </button>
              <a
                href={live.url}
                target="_blank"
                rel="noreferrer"
                className="size-8 grid place-items-center rounded-lg hover:bg-card"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="size-4" /> No live version yet.
            </div>
          )}

          {/* Pre-publish form */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                SEO Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="Acme — Smart invoicing for freelancers"
                className="mt-1 w-full bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{title.length}/60</p>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Meta Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={160}
                rows={2}
                placeholder="Send invoices in seconds and get paid faster. Built for solo founders."
                className="mt-1 w-full bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30 resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{description.length}/160</p>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Subdomain
              </label>
              <div className="mt-1 flex items-center gap-1 rounded-xl bg-muted/60 px-3 py-2 focus-within:ring-2 ring-primary/30">
                <input
                  value={subdomain}
                  onChange={(e) => setSubdomain(slugify(e.target.value))}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                <span className="text-xs text-muted-foreground">.breezy.app</span>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="rounded-xl border border-border p-3 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Pre-publish checks
            </p>
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <span
                  className={`size-4 rounded-full grid place-items-center ${
                    c.ok ? "bg-mint text-ink" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {c.ok ? <Check className="size-2.5" strokeWidth={3} /> : null}
                </span>
                <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* Deployments history */}
          {deployments.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Deploy history
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1.5">
                {deployments.map((d, i) => (
                  <div
                    key={d.id}
                    className={`text-xs flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                      i === 0 ? "bg-primary/5 border border-primary/20" : "bg-muted/40"
                    }`}
                  >
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-card border border-border">
                      v{d.version}
                    </span>
                    <span className="flex-1 truncate">{d.url}</span>
                    <span className="text-muted-foreground">
                      {new Date(d.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            disabled={!ready}
            onClick={() => {
              onPublish({ title: title.trim(), description: description.trim(), subdomain });
              onOpenChange(false);
            }}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full bg-ink text-cream hover:scale-[1.01] transition disabled:opacity-40 disabled:scale-100"
          >
            <Rocket className="size-4" />
            {live ? "Update live site" : "Publish to breezy.app"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
