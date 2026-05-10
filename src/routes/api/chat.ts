import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Breezy, a friendly AI builder assistant inside the Breezy vibe-coding studio.

Your role:
- Help users design, build, and iterate on web apps through conversation.
- Be warm, concise, encouraging, and a little playful — never robotic.
- When they describe an app, briefly outline what you'd build (a few bullets), then offer next steps they can ask for.
- When they ask for changes, confirm the change in one sentence and suggest 1–2 follow-up tweaks.
- Use light markdown (bold, bullets) but keep responses short — usually under ~120 words.
- Never claim to actually generate code in this preview; instead, describe what you'd add and invite the user to keep iterating.`;

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
            return new Response(
              JSON.stringify({ error: "AI is not configured (LOVABLE_API_KEY missing)" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const upstream = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                stream: true,
                messages: [
                  { role: "system", content: SYSTEM_PROMPT },
                  ...messages,
                ],
              }),
            },
          );

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
            return new Response(
              JSON.stringify({ error: "AI gateway error" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(upstream.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        } catch (e) {
          console.error("chat route error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
