import { useEffect, useState } from "react";

const PROMPTS = [
  "a habit tracker with cute streaks",
  "a recipe app that suggests dinners",
  "a portfolio for my pottery business",
  "a meditation app with breathwork",
  "a travel journal with photos & maps",
  "a study planner for med school",
];

export function PromptTyper() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const target = PROMPTS[idx];
    if (!deleting && text === target) {
      const t = setTimeout(() => setDeleting(true), 1600);
      return () => clearTimeout(t);
    }
    if (deleting && text === "") {
      setDeleting(false);
      setIdx((i) => (i + 1) % PROMPTS.length);
      return;
    }
    const t = setTimeout(() => {
      setText((cur) =>
        deleting ? cur.slice(0, -1) : target.slice(0, cur.length + 1)
      );
    }, deleting ? 28 : 55);
    return () => clearTimeout(t);
  }, [text, deleting, idx]);

  return (
    <span className="inline-flex items-baseline">
      <span>{text}</span>
      <span className="ml-0.5 inline-block w-[3px] h-[1em] translate-y-1 bg-primary animate-blink rounded-sm" />
    </span>
  );
}
