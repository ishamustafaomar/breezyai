import { createFileRoute } from "@tanstack/react-router";

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

const STATUS_PREFIX = "<!--BREEZY_GENERATION_STATUS:";
const STATUS_SUFFIX = ":BREEZY_GENERATION_STATUS-->";

const SYSTEM_PROMPT = `You are Breezy's site generator — an elite product designer + frontend engineer. You output ONE complete, self-contained HTML5 document for a single-page website that looks like it was built by a top design studio (think Linear, Vercel, Stripe, Apple).

OUTPUT RULES (strict):
- Output ONLY the raw HTML. No markdown fences, no commentary.
- Start with <!DOCTYPE html> and end with </html>.
- <meta name="viewport" content="width=device-width,initial-scale=1">.
- Tailwind via <script src="https://cdn.tailwindcss.com"></script> in <head>.
- Configure Tailwind inline with a custom theme (extend colors, fontFamily) BEFORE the CDN script runs is not possible — instead, use a <script>tailwind.config = {...}</script> AFTER the CDN script.
- Google Fonts: a tasteful display font (Fraunces, Instrument Serif, Space Grotesk, or Cal Sans alternative) + Inter for body.
- Inline critical CSS in a <style> block for: smooth scroll, gradient text, custom scrollbar, subtle noise/grain, animated blobs, fade-in on load.

DESIGN BAR (this is the most important part):
- Hero must be visually stunning: large display headline (5xl–7xl), gradient or layered text accent, supporting sub-headline, dual CTAs (primary + ghost), trust row (logos as styled text or emoji), and a decorative element (gradient blob, abstract SVG, screenshot mockup made of divs, app preview card, or floating UI elements).
- Use a cohesive, intentional color system. Pick a palette (2-3 brand colors + neutrals) and stick to it. Never use default Tailwind blue-500 / gray-900 — pick refined shades (slate, zinc, stone, plus a vivid accent like indigo-600, emerald-500, rose-500, amber-400).
- Generous whitespace. Sections should breathe (py-20 to py-32).
- Typography hierarchy: display font for h1/h2 with tight tracking (tracking-tight), Inter for body, muted secondary text.
- Cards: rounded-2xl or rounded-3xl, soft borders (border border-black/5), layered shadows, subtle hover lift.
- Include 5-7 sections minimum: Nav, Hero, Logo cloud / social proof, Feature grid (3 cards with icons), Big feature with mock UI or imagery, Testimonial(s), Pricing or CTA banner, Footer with multiple columns.
- Build "imagery" with pure CSS/SVG: gradient blobs, abstract SVG illustrations, faux app screenshots assembled from divs, glassmorphism cards. NO external image URLs.
- Icons: inline SVG (Heroicons-style 24x24 outline). No icon libraries.
- Subtle motion: fade/slide-in via CSS animations on load, hover transitions on cards/buttons (transition-all duration-300), gradient hue shift, animated gradient blobs.
- Real, on-topic copy tailored to the user's idea. No lorem ipsum. Specific, benefit-driven, confident voice.
- Responsive (mobile-first). Looks great at 380px, 820px, and 1200px wide.
- Accessibility: semantic tags, aria-labels on icon buttons, alt-equivalent on decorative SVGs (aria-hidden), good contrast.

Do not over-expand. Finish the entire document every time. A complete, polished 350-650 line document is better than an unfinished 1000-line draft.

Aim for a complete premium site that never cuts off mid-section. Quality and completeness over length.`;

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages, currentHtml } = (await request.json()) as {
            messages: GatewayMessage[];
            currentHtml?: string;
          };

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ error: "AI is not configured (LOVABLE_API_KEY missing)" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const isEdit = !!(currentHtml && currentHtml.length > 200);
          const finalUserPrompt = isEdit
            ? `Here is the CURRENT HTML for the site:\n\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nApply the latest user request from the conversation to this HTML. Preserve everything that wasn't asked to change — same structure, palette, copy — and only modify what's needed. Output the COMPLETE updated HTML document. HTML only, no fences, no commentary.`
            : "Now output the complete, premium-quality HTML document for this site. Remember: studio-grade design bar, 5-7 sections, real copy, pure CSS/SVG imagery, 350-650 finished lines. HTML only, no fences. Do not stop until the document ends with </html>.";

          const baseMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
            { role: "user", content: finalUserPrompt },
          ];

          const callGateway = (msgs: typeof baseMessages) =>
            fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "openai/gpt-5-mini",
                stream: true,
                max_completion_tokens: 32000,
                reasoning: { effort: "minimal" },
                messages: msgs,
              }),
            });

          const upstream = await callGateway(baseMessages);

          if (!upstream.ok || !upstream.body) {
            if (upstream.status === 429)
              return new Response(JSON.stringify({ error: "Rate limited — try again shortly." }), {
                status: 429,
                headers: { "Content-Type": "application/json" },
              });
            if (upstream.status === 402)
              return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
                status: 402,
                headers: { "Content-Type": "application/json" },
              });
            const t = await upstream.text().catch(() => "");
            console.error("generate gateway error:", upstream.status, t);
            return new Response(JSON.stringify({ error: "AI gateway error" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Re-stream as a simple text stream of raw HTML deltas to the client.
          const reader = upstream.body.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();
          let buf = "";
          let finishReason = "";
          let emittedContent = false;

          const processSseLine = (
            line: string,
            controller: ReadableStreamDefaultController<Uint8Array>,
          ) => {
            const t = line.trim();
            if (!t.startsWith("data:")) return false;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") return true;
            try {
              const json = JSON.parse(payload);
              const choice = json.choices?.[0];
              if (choice?.finish_reason) finishReason = choice.finish_reason;
              const delta = choice?.delta?.content;
              if (delta) {
                emittedContent = true;
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              /* ignore malformed stream fragments */
            }
            return false;
          };

          const enqueueStatus = (controller: ReadableStreamDefaultController<Uint8Array>) => {
            const complete = emittedContent && (!finishReason || finishReason === "stop");
            const status = complete ? "complete" : `incomplete:${finishReason || "no-content"}`;
            controller.enqueue(encoder.encode(`${STATUS_PREFIX}${status}${STATUS_SUFFIX}`));
          };

          const stream = new ReadableStream({
            async pull(controller) {
              const { value, done } = await reader.read();
              if (done) {
                if (buf.trim()) processSseLine(buf, controller);
                enqueueStatus(controller);
                controller.close();
                return;
              }
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              for (const line of lines) {
                processSseLine(line, controller);
              }
            },
            cancel() {
              reader.cancel().catch(() => {});
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
            },
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
