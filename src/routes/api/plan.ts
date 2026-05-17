import { createFileRoute } from "@tanstack/react-router";

// Returns a structured plan the user can review before generation.
// Shape is intentionally JSON so the UI can render Approve / Skip / Edit
// affordances without parsing prose.

const SYSTEM_PROMPT = `You are Breezy's planner. Given a user request, you produce a SHORT structured build plan that a separate generator will execute.

Return ONLY valid minified JSON with this exact shape:
{
  "summary": "one sentence describing what we'll build",
  "sections": ["3 to 6 page/section names — e.g. Hero, Features, Pricing"],
  "vibe": "one short phrase, e.g. 'minimal & premium with warm coral accents'",
  "questions": ["0 to 2 short clarifying questions; empty array if request is clear"]
}

Rules:
- No prose outside the JSON. No code fences. No commentary.
- Keep arrays short. Each string under 80 chars.
- If connectors are listed in the user message, mention them in summary where natural (e.g. "wire signup using Supabase").`;

export const Route = createFileRoute("/api/plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages, connectorsContext } = (await request.json()) as {
            messages: { role: "user" | "assistant"; content: string }[];
            connectorsContext?: string;
          };

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return Response.json({ error: "AI is not configured" }, { status: 500 });
          }

          const userContent = [
            connectorsContext ? connectorsContext : "",
            "Conversation so far:",
            ...messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`),
            "",
            "Produce the plan JSON now.",
          ]
            .filter(Boolean)
            .join("\n");

          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userContent },
              ],
            }),
          });

          if (!upstream.ok) {
            const t = await upstream.text().catch(() => "");
            console.error("plan upstream error:", upstream.status, t);
            return Response.json({ error: "Planner failed" }, { status: 500 });
          }

          const data = (await upstream.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const raw = data.choices?.[0]?.message?.content ?? "{}";

          let parsed: unknown = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { summary: "Build the project you described.", sections: [], vibe: "", questions: [] };
          }
          return Response.json(parsed);
        } catch (e) {
          console.error("plan route error:", e);
          return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
        }
      },
    },
  },
});
