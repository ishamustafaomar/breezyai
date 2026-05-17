import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plug, Search, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  CONNECTORS,
  CATEGORIES,
  type Connection,
  type Connector,
  isConnected,
  saveConnections,
} from "@/lib/connectors";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connections: Connection[];
  setConnections: (c: Connection[]) => void;
};

export function ConnectorsPanel({ open, onOpenChange, connections, setConnections }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONNECTORS;
    return CONNECTORS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (c: Connector) => {
    if (c.tier === 2) {
      toast.info(`${c.name} is coming soon`, { description: "We're working on this integration." });
      return;
    }
    const exists = isConnected(connections, c.id);
    if (exists) {
      const next = connections.filter((x) => x.connectorId !== c.id);
      setConnections(next);
      saveConnections(next);
      toast.success(`Disconnected ${c.name}`);
    } else {
      const next = [
        ...connections.filter((x) => x.connectorId !== c.id),
        { connectorId: c.id, status: "connected" as const, connectedAt: Date.now() },
      ];
      setConnections(next);
      saveConnections(next);
      toast.success(`Connected ${c.name}`, {
        description: c.auth === "oauth" ? "Account linked (demo mode)" : "API key saved (demo mode)",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 pt-6 pb-4">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-xl">
              <Plug className="size-5" /> Connectors
            </SheetTitle>
            <SheetDescription>
              Connect external services to give Breezy more context when building.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search connectors…"
              className="w-full bg-muted/60 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30"
            />
          </div>
        </div>

        <div className="px-6 py-5 space-y-7">
          {CATEGORIES.map((cat) => {
            const items = filtered.filter((c) => c.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5">
                  {cat}
                </h3>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {items.map((c) => {
                    const connected = isConnected(connections, c.id);
                    const soon = c.tier === 2;
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggle(c)}
                        className={`group text-left rounded-2xl border p-3.5 transition flex gap-3 items-start ${
                          connected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        <div
                          className={`size-10 rounded-xl grid place-items-center text-[11px] font-bold text-white shrink-0 bg-gradient-to-br ${c.gradient} shadow-soft`}
                        >
                          {c.mark}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold">{c.name}</span>
                            {soon ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                Soon
                              </span>
                            ) : connected ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-mint/40 text-ink inline-flex items-center gap-0.5">
                                <Check className="size-2.5" strokeWidth={3} /> On
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!filtered.length && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Sparkles className="size-5 mx-auto mb-2" />
              No connectors match “{query}”.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
