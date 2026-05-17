import { Check, X, Sparkles, Loader2 } from "lucide-react";

export type Plan = {
  summary: string;
  sections: string[];
  vibe: string;
  questions: string[];
};

type Props = {
  plan: Plan | null;
  loading: boolean;
  status: "pending" | "approved" | "skipped";
  onApprove: () => void;
  onSkip: () => void;
};

export function PlanCard({ plan, loading, status, onApprove, onSkip }: Props) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-accent/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-lg bg-primary/20 grid place-items-center">
          <Sparkles className="size-3.5 text-primary" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-semibold">Plan</span>
        {status === "approved" && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-mint/40 text-ink ml-auto">
            Approved
          </span>
        )}
        {status === "skipped" && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-auto">
            Skipped
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Thinking through the build…
        </div>
      ) : plan ? (
        <div className="space-y-2.5 text-sm">
          <p className="leading-relaxed">{plan.summary}</p>
          {plan.sections?.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Sections</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.sections.map((s, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full bg-card border border-border"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {plan.vibe && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Vibe</p>
              <p className="text-xs italic text-muted-foreground">{plan.vibe}</p>
            </div>
          )}
          {plan.questions?.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Questions</p>
              <ul className="text-xs space-y-0.5">
                {plan.questions.map((q, i) => (
                  <li key={i} className="text-muted-foreground">• {q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {status === "pending" && !loading && plan && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full bg-ink text-cream hover:scale-[1.03] transition"
          >
            <Check className="size-3.5" strokeWidth={3} /> Approve & build
          </button>
          <button
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full hover:bg-card text-muted-foreground hover:text-foreground transition"
          >
            <X className="size-3.5" /> Skip
          </button>
        </div>
      )}
    </div>
  );
}
