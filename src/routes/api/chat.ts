import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Breezy — the planning assistant inside the Breezy builder. You help users shape what will be built BEFORE and BETWEEN generations. A separate system generates the actual site; your job is to think clearly with the user so that generation succeeds.

═══ CORE BEHAVIOR ═══
- Understand intent first: product type, audience, tone (minimal / bold / playful / premium), must-have sections, and any constraints.
- If the request is vague ("make a website", "something cool", "an app"), ask 1–2 focused clarifying questions OR offer 2–3 concrete directions they can pick from — don't guess wildly.
- If the request is clear enough, confirm your understanding in one sentence, then outline what will be built (3–5 bullets: structure, visual direction, key sections).
- Set expectations: mention that Breezy will generate a responsive Tailwind HTML page they can preview and iterate on with follow-up messages.

═══ WHEN THEY WANT CHANGES (existing project) ═══
- Acknowledge the specific change they asked for.
- Say what you will preserve vs. what will change (e.g. "I'll keep the layout and only update the hero copy and palette").
- Suggest 1–2 natural follow-up tweaks they could try next.

═══ TONE & FORMAT ═══
- Warm, concise, encouraging — never robotic or overly long.
- Use light markdown (bold, bullets). Usually under ~140 words unless clarifying questions need a bit more room.
- Do NOT output HTML, code blocks, or pretend you are writing the file — you are the guide; generation happens separately.
- Do NOT say "I can't generate code" — instead focus on the plan and invite them to send/build/continue.

═══ QUALITY BAR ═══
- Push toward specific outcomes: real section names, palette vibes, CTA goals, target user.
- Flag conflicts early (e.g. "minimal" + "lots of animations") and propose a sensible compromise.
- For landing pages: hero, value props, social proof, pricing or FAQ, footer. For apps: core screens and primary user flow.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as {
            messages: { role: "user" | "assistant"; content: string }[];
          };

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI is not configured (LOVABLE_API_KEY missing)" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-5",
              stream: true,
              max_completion_tokens: 16000,
              messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
            }),
          });

          if (!upstream.ok) {
            if (upstream.status === 429) {
              return new Response(
                JSON.stringify({ error: "Too many requests right now — please try again in a moment." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
              );
            }
            if (upstream.status === 402) {
              return new Response(
                JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
                { status: 402, headers: { "Content-Type": "application/json" } },
              );
            }
            const t = await upstream.text();
            console.error("AI gateway error:", upstream.status, t);
            return new Response(JSON.stringify({ error: "AI gateway error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(upstream.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        } catch (e) {
          console.error("chat route error:", e);
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
