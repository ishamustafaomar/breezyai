import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe, Check, Loader2, X, Copy, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeDomain, validationError, BREEZY_ROOT_DOMAIN } from "@/lib/domain-utils";

type Site = {
  id: string;
  project_id: string;
  subdomain: string | null;
  custom_domain: string | null;
  domain_verified: boolean;
  domain_verification_token: string | null;
  domain_verified_at: string | null;
};

async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export function CustomDomainDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"add" | "verify" | "remove" | null>(null);
  const [pollDeadline, setPollDeadline] = useState<number | null>(null);

  const subdomain = (site?.subdomain ?? projectId.slice(0, 8)) || "your-app";

  const load = async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/api/domains/status?projectId=${encodeURIComponent(projectId)}`);
      const json = await res.json();
      if (res.ok) setSite(json.site);
    } catch {
      /* ignore — will surface on next action */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-poll while pending (up to 10 minutes total).
  useEffect(() => {
    if (!site?.custom_domain || site.domain_verified) {
      setPollDeadline(null);
      return;
    }
    if (!pollDeadline) setPollDeadline(Date.now() + 10 * 60 * 1000);
    const id = setInterval(async () => {
      if (pollDeadline && Date.now() > pollDeadline) {
        clearInterval(id);
        return;
      }
      await runVerify({ silent: true });
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.custom_domain, site?.domain_verified, pollDeadline]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validationError(input);
    if (err) {
      setInlineError(err);
      return;
    }
    setInlineError(null);
    setBusy("add");
    try {
      const res = await authedFetch("/api/domains/add", {
        method: "POST",
        body: JSON.stringify({ projectId, customDomain: normalizeDomain(input) }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Couldn't add domain");
        return;
      }
      toast.success("Domain added — add the TXT record to verify");
      setInput("");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const runVerify = async ({ silent }: { silent?: boolean } = {}) => {
    setBusy("verify");
    try {
      const res = await authedFetch("/api/domains/verify", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (!silent) toast.error(json.error || "Verification failed");
        return;
      }
      if (json.verified) {
        toast.success(json.message || "Verified!");
        await load();
      } else if (!silent) {
        toast(json.message || "Not verified yet", { icon: "⏳" });
      }
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async () => {
    if (!confirm("Disconnect this domain from your Breezy site?")) return;
    setBusy("remove");
    try {
      const res = await authedFetch("/api/domains/remove", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || "Couldn't remove domain");
        return;
      }
      toast.success("Domain disconnected");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const pollExpired = pollDeadline !== null && Date.now() > pollDeadline;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <h2 className="font-display font-bold text-lg">Custom domain</h2>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-full hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 rounded-xl bg-muted animate-pulse" />
              <div className="h-32 rounded-xl bg-muted animate-pulse" />
            </div>
          ) : !site?.custom_domain ? (
            <StateNoDomain
              input={input}
              setInput={(v) => {
                setInput(v);
                if (inlineError) setInlineError(null);
              }}
              onSubmit={onAdd}
              busy={busy === "add"}
              inlineError={inlineError}
              subdomain={subdomain}
            />
          ) : site.domain_verified ? (
            <StateVerified site={site} subdomain={subdomain} onRemove={onRemove} busy={busy === "remove"} />
          ) : (
            <StatePending
              site={site}
              onVerify={() => runVerify()}
              onRemove={onRemove}
              busyVerify={busy === "verify"}
              busyRemove={busy === "remove"}
              pollExpired={pollExpired}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StateNoDomain({
  input,
  setInput,
  onSubmit,
  busy,
  inlineError,
  subdomain,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  inlineError: string | null;
  subdomain: string;
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-2">
        <label className="text-sm font-medium">Your domain</label>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="myapp.com"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-ink text-cream disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
            Connect
          </button>
        </div>
        {inlineError && (
          <p className="text-xs text-rose flex items-center gap-1">
            <AlertCircle className="size-3" /> {inlineError}
          </p>
        )}
      </form>
      <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">Your free subdomain</p>
        <p className="text-sm font-mono font-semibold mt-0.5">
          {subdomain}.{BREEZY_ROOT_DOMAIN}
        </p>
      </div>
    </>
  );
}

function StatePending({
  site,
  onVerify,
  onRemove,
  busyVerify,
  busyRemove,
  pollExpired,
}: {
  site: Site;
  onVerify: () => void;
  onRemove: () => void;
  busyVerify: boolean;
  busyRemove: boolean;
  pollExpired: boolean;
}) {
  const recordName = `_breezy-verify.${site.custom_domain}`;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{site.custom_domain}</span>
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium">
          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending verification
        </span>
      </div>

      <ol className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="size-6 rounded-full bg-muted text-foreground grid place-items-center text-xs font-bold shrink-0">
            1
          </span>
          <p className="text-muted-foreground pt-0.5">
            Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.).
          </p>
        </li>
        <li className="flex gap-3">
          <div className="flex-1">
            <div className="flex gap-3">
              <span className="size-6 rounded-full bg-muted text-foreground grid place-items-center text-xs font-bold shrink-0">
                2
              </span>
              <p className="text-muted-foreground pt-0.5">Add this DNS TXT record:</p>
            </div>
            <div className="mt-2 ml-9 rounded-2xl border border-border bg-background overflow-hidden text-xs font-mono">
              <DnsRow label="Type" value="TXT" />
              <DnsRow label="Host" value={recordName} copyable />
              <DnsRow label="Value" value={site.domain_verification_token || ""} copyable last />
            </div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="size-6 rounded-full bg-muted text-foreground grid place-items-center text-xs font-bold shrink-0">
            3
          </span>
          <p className="text-muted-foreground pt-0.5">
            Click <strong>Verify</strong> below. DNS can take up to 48 hours to propagate — we'll re-check
            automatically every 30 seconds.
          </p>
        </li>
      </ol>

      {pollExpired && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          DNS is taking longer than usual — double-check your records and try verifying manually.
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onVerify}
          disabled={busyVerify}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-ink text-cream disabled:opacity-40"
        >
          {busyVerify ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Verify now
        </button>
        <button
          onClick={onRemove}
          disabled={busyRemove}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl hover:bg-muted disabled:opacity-40"
        >
          <Trash2 className="size-3.5" /> Remove domain
        </button>
      </div>
    </div>
  );
}

function StateVerified({
  site,
  subdomain,
  onRemove,
  busy,
}: {
  site: Site;
  subdomain: string;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{site.custom_domain}</span>
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-mint/20 text-emerald-700 dark:text-emerald-400 font-medium">
          <Check className="size-3" /> Verified
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{site.custom_domain}</strong> is connected to your site.
      </p>
      <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-xs space-y-1.5">
        <p className="font-semibold">Final step — point a CNAME:</p>
        <div className="rounded-xl bg-background border border-border overflow-hidden font-mono">
          <DnsRow label="Type" value="CNAME" />
          <DnsRow label="Host" value="@ or www" />
          <DnsRow label="Value" value={`${subdomain}.${BREEZY_ROOT_DOMAIN}`} copyable last />
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-rose px-3 py-2 rounded-xl hover:bg-muted disabled:opacity-40"
      >
        <Trash2 className="size-3.5" /> Remove domain
      </button>
    </div>
  );
}

function DnsRow({
  label,
  value,
  copyable,
  last,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 gap-3 ${last ? "" : "border-b border-border"}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="truncate">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value);
              toast.success("Copied");
            }}
            className="text-muted-foreground hover:text-foreground shrink-0"
            title="Copy"
          >
            <Copy className="size-3" />
          </button>
        )}
      </span>
    </div>
  );
}
