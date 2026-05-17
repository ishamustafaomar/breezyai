import { useEffect } from "react";

type Handler = () => void;

/** Bind Cmd/Ctrl+key combos. Pass {} to disable any single binding. */
export function useShortcuts(map: {
  onPlan?: Handler;
  onPublish?: Handler;
  onFocusChat?: Handler;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "p" && e.shiftKey) {
        e.preventDefault();
        map.onPublish?.();
      } else if (key === "p") {
        e.preventDefault();
        map.onPlan?.();
      } else if (key === "/") {
        e.preventDefault();
        map.onFocusChat?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map]);
}
