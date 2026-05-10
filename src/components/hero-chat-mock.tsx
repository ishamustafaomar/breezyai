import { Sparkles, ArrowUp } from "lucide-react";
import { PromptTyper } from "./prompt-typer";

export function HeroChatMock() {
  return (
    <div className="relative animate-pop-in">
      {/* Floating shapes */}
      <div className="absolute -top-10 -left-10 size-24 rounded-3xl bg-gradient-fresh shadow-soft animate-float-slow rotate-12 hidden md:block" />
      <div className="absolute -bottom-8 -right-8 size-20 rounded-full bg-gradient-cool shadow-soft animate-float hidden md:block" />
      <div className="absolute top-1/3 -right-16 size-14 rounded-2xl bg-butter shadow-soft animate-float-slow hidden lg:block" />

      <div className="relative rounded-3xl bg-card border border-border shadow-card overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/70 bg-muted/40">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-rose" />
            <span className="size-2.5 rounded-full bg-butter" />
            <span className="size-2.5 rounded-full bg-mint" />
          </div>
          <div className="ml-3 text-xs text-muted-foreground font-mono">breezy.app/new</div>
        </div>

        <div className="p-6 sm:p-8 space-y-4">
          {/* AI message */}
          <div className="flex gap-3">
            <div className="shrink-0 size-9 rounded-2xl bg-gradient-warm grid place-items-center shadow-soft">
              <Sparkles className="size-4 text-ink" strokeWidth={2.5} />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm max-w-[85%]">
              Hey! What are we building today? <span className="text-muted-foreground">I'll spin it up in seconds ✨</span>
            </div>
          </div>

          {/* User message */}
          <div className="flex gap-3 justify-end">
            <div className="rounded-2xl rounded-tr-sm bg-ink text-cream px-4 py-3 text-sm max-w-[85%]">
              I want to build <PromptTyper />
            </div>
          </div>

          {/* Generating */}
          <div className="flex gap-3">
            <div className="shrink-0 size-9 rounded-2xl bg-gradient-warm grid place-items-center shadow-soft">
              <Sparkles className="size-4 text-ink" strokeWidth={2.5} />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-gradient-rainbow bg-[length:200%_100%] animate-shimmer px-4 py-3 text-sm">
              <span className="font-medium">Generating…</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["layout", "components", "color palette", "data model"].map((t, i) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-card/80 text-xs font-medium animate-pop-in"
                    style={{ animationDelay: `${i * 200}ms` }}
                  >
                    ✓ {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border/70 bg-background/60">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 focus-within:ring-2 ring-primary/30 transition">
            <input
              readOnly
              placeholder="Make the buttons rounder and add dark mode…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            <button className="size-8 rounded-full bg-ink text-cream grid place-items-center hover:scale-105 transition">
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
