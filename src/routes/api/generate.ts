import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Breezy's site generator. Given a user's idea and conversation, you output ONE complete, self-contained HTML5 document for a single-page website that matches their request.

Hard rules:
- Output ONLY the raw HTML. No markdown fences, no commentary, no explanations.
- Start with <!DOCTYPE html> and end with </html>.
- Include <meta name="viewport" content="width=device-width,initial-scale=1">.
- Use Tailwind via <script src="https://cdn.tailwindcss.com"></script> in <head>.
- Use Google Fonts (Inter + a tasteful display font like Fraunces or Space Grotesk) via <link>.
- Design: modern, polished, generous whitespace, soft pastel palette by default unless the prompt suggests otherwise. Beautiful gradients, rounded-2xl cards, subtle shadows, smooth hover states.
- Include real, on-topic copy (not lorem ipsum) tailored to the user's idea.
- Include multiple sections as appropriate: hero, features/benefits, social proof or stats, pricing or CTA, footer.
- Use emoji sparingly as decorative icons where it fits.
- Use only inline images via emoji or CSS gradients/SVG — no external image URLs.
- Make it responsive and accessible (semantic tags, alt text on any svg with role).
- The page should look great inside a 1200px-wide iframe.`;

export const Route = createFileRoute("/api/generate")({
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
                messages: [
                  { role: "system", content: SYSTEM_PROMPT },
                  ...messages,
                  {
                    role: "user",
                    content:
                      "Now output the complete HTML document for this site. HTML only, no fences.",
                  },
                ],
              }),
            },
          );

          if (!upstream.ok) {
            if (upstream.status === 429)
              return new Response(JSON.stringify({ error: "Rate limited — try again shortly." }), {
                status: 429, headers: { "Content-Type": "application/json" },
              });
            if (upstream.status === 402)
              return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
                status: 402, headers: { "Content-Type": "application/json" },
              });
            const t = await upstream.text();
            console.error("generate gateway error:", upstream.status, t);
            return new Response(JSON.stringify({ error: "AI gateway error" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }

          const data = (await upstream.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          let html = data.choices?.[0]?.message?.content?.trim() ?? "";
          // Strip accidental markdown fences
          html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
          if (!html.toLowerCase().startsWith("<!doctype") && !html.toLowerCase().startsWith("<html")) {
            // Wrap if model returned a fragment
            html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script></head><body>${html}</body></html>`;
          }

          return new Response(JSON.stringify({ html }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("generate route error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
