import { createFileRoute } from "@tanstack/react-router";

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

const STATUS_PREFIX = "<!--BREEZY_GENERATION_STATUS:";
const STATUS_SUFFIX = ":BREEZY_GENERATION_STATUS-->";

const SYSTEM_PROMPT = `You are Breezy's site generator — a world-class product designer and senior frontend engineer. Every output you produce should look indistinguishable from work shipped by Linear, Vercel, Stripe, Arc, Raycast, Framer, or Apple. The bar is "wow, this looks like a real funded startup," not "AI demo."

OUTPUT FORMAT (strict):
- Output ONLY the raw HTML5 document. No markdown fences, no commentary, no preamble.
- Start with <!DOCTYPE html>, end with </html>.
- <meta name="viewport" content="width=device-width,initial-scale=1"> and a real <title> + <meta name="description">.
- Load Tailwind via <script src="https://cdn.tailwindcss.com"></script> in <head>, then immediately a <script>tailwind.config = { theme: { extend: { colors: {...}, fontFamily: {...}, boxShadow: {...}, animation: {...}, keyframes: {...} } } }</script> with a real, considered theme.
- Load Google Fonts in <head> with preconnect: a refined display font (one of: "Instrument Serif", "Fraunces", "Space Grotesk", "Plus Jakarta Sans", "General Sans", "Söhne" alt "Inter Tight") + Inter (or "Geist") for body. Apply via the Tailwind theme.
- Inline a rich <style> block with: html { scroll-behavior: smooth }, custom selection color, custom scrollbar, gradient text utility, animated gradient blobs (filter: blur(80px); mix-blend-mode), subtle SVG noise overlay, fade/slide-up keyframes that auto-trigger on load, marquee for logo strip if used.

DESIGN BAR — this is what matters most:
- Pick ONE intentional aesthetic that fits the user's idea (e.g. "warm editorial," "dark techy with neon accent," "clean Apple-grade minimal," "playful pastel," "brutalist mono"). Commit to it. No generic "AI website" look.
- Cohesive palette: 1 brand accent + 1 supporting accent + a neutral ramp. Use refined shades (zinc/stone/neutral/slate, indigo-600, emerald-500, rose-500, amber-400, violet-500) — NEVER default blue-500/gray-900. Dark themes use near-black like #0A0A0A / #0B0B0F, not pure black.
- Typography: display font for h1/h2 with tight tracking (tracking-tight or tracking-tighter), large sizes (text-5xl md:text-7xl lg:text-8xl on hero), measured line-height (leading-[1.05]), muted secondary text (text-zinc-500/600). Mix serif display + sans body when it fits the brand for editorial polish.
- Hero: huge headline with at least one gradient or italic-serif accent word, a confident 1-2 sentence subhead, dual CTAs (primary solid + ghost with arrow), small trust row (avatars + "Trusted by 12,000 teams" or styled wordmarks), and a hero visual built from divs/SVG (faux app UI, dashboard mock, browser chrome with content, floating cards, layered gradient blobs behind). The hero must feel custom, not template.
- Sections (pick 6-9 that fit the product): sticky glass nav, hero, logo cloud / marquee, feature grid (3-6 cards w/ inline SVG icons), a big "bento grid" feature section with varied card sizes, a faux product/app screenshot section assembled from divs, stats row (3-4 big numbers), testimonials (avatar circles w/ initials + gradient bg, real-sounding quotes), pricing (2-3 tiers with one highlighted), FAQ (accordion via <details>), bold CTA banner, multi-column footer with newsletter input.
- Cards: rounded-2xl/3xl, border border-white/10 on dark or border-black/5 on light, layered shadows (shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_30px_60px_-30px_rgba(0,0,0,0.5)]), subtle hover lift + ring on hover.
- Buttons: pill or rounded-xl, solid primary with subtle gradient + inner highlight, ghost secondary with arrow icon, hover scale/translate, focus ring.
- Imagery: ALL visuals built from CSS + inline SVG. Gradient blobs (absolute, blurred, animated), abstract SVG shapes, faux app UIs (sidebar + content + chart bars made of divs), glass cards (backdrop-blur-xl bg-white/5 border-white/10). NO external image URLs, NO unsplash, NO placeholder.com.
- Icons: inline 24x24 stroke SVGs (Heroicons/Lucide style, stroke-width 1.75). Consistent style across the page.
- Motion: load-in fade/translate via CSS animation-delay staircase, hover transitions (transition duration-300 ease-out), animated gradient position shift on hero blobs, marquee for logos.
- Copy: REAL, specific, benefit-driven, confident — written for this exact idea. Product name, tagline, feature names, testimonial names + roles + companies, pricing tiers, FAQ questions all on-topic. Zero lorem ipsum, zero "Lorem," zero generic "Feature One / Feature Two."
- Responsive mobile-first. Test mentally at 380px, 768px, 1200px, 1440px. Nav collapses to a hamburger or simplified row on mobile.
- Accessibility: semantic landmarks (header/nav/main/section/footer), aria-labels on icon-only buttons, aria-hidden on decorative SVG, sufficient contrast, visible focus rings.

QUALITY GATES (self-check before finishing):
1. Could this be on the homepage of a YC-backed startup? If no, raise the bar.
2. Is there at least ONE custom hero visual that isn't just text + a button?
3. Does every section have a clear purpose and distinct visual rhythm (no two sections look the same)?
4. Is the copy specific to the user's idea, not swappable boilerplate?
5. Does it end with a complete </body></html>?

Aim for a complete, polished 500-900 line document. Quality + completeness > length, but never sacrifice the design bar to save tokens. Always finish with </html>.`;

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
          // Auto-continue if the model hits the token cap before closing </html>.
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();
          let emittedAll = "";
          let emittedContent = false;
          let lastFinishReason = "";

          const stream = new ReadableStream({
            async start(controller) {
              const consume = async (resp: Response) => {
                const reader = resp.body!.getReader();
                let buf = "";
                let finishReason = "";

                const processLine = (line: string) => {
                  const t = line.trim();
                  if (!t.startsWith("data:")) return;
                  const payload = t.slice(5).trim();
                  if (!payload || payload === "[DONE]") return;
                  try {
                    const json = JSON.parse(payload);
                    const choice = json.choices?.[0];
                    if (choice?.finish_reason) finishReason = choice.finish_reason;
                    const delta = choice?.delta?.content;
                    if (delta) {
                      emittedContent = true;
                      emittedAll += delta;
                      controller.enqueue(encoder.encode(delta));
                    }
                  } catch {
                    /* ignore */
                  }
                };

                while (true) {
                  const { value, done } = await reader.read();
                  if (done) {
                    if (buf.trim()) processLine(buf);
                    break;
                  }
                  buf += decoder.decode(value, { stream: true });
                  const lines = buf.split("\n");
                  buf = lines.pop() ?? "";
                  for (const line of lines) processLine(line);
                }
                return finishReason;
              };

              try {
                lastFinishReason = await consume(upstream);

                // Auto-continue up to 3 times if we hit length cap without finishing the doc.
                let attempts = 0;
                while (
                  attempts < 3 &&
                  lastFinishReason === "length" &&
                  !emittedAll.toLowerCase().includes("</html>")
                ) {
                  attempts++;
                  const continueMessages = [
                    { role: "system" as const, content: SYSTEM_PROMPT },
                    ...messages,
                    { role: "user" as const, content: finalUserPrompt },
                    { role: "assistant" as const, content: emittedAll },
                    {
                      role: "user" as const,
                      content:
                        "Continue the HTML document EXACTLY where you left off. Do not repeat any prior content, do not add commentary or fences. Output only the remaining HTML and end with </html>.",
                    },
                  ];
                  const next = await callGateway(continueMessages);
                  if (!next.ok || !next.body) break;
                  lastFinishReason = await consume(next);
                }

                const complete =
                  emittedContent &&
                  emittedAll.toLowerCase().includes("</html>") &&
                  (lastFinishReason === "" || lastFinishReason === "stop");
                const status = complete
                  ? "complete"
                  : `incomplete:${lastFinishReason || "no-content"}`;
                controller.enqueue(encoder.encode(`${STATUS_PREFIX}${status}${STATUS_SUFFIX}`));
                controller.close();
              } catch (err) {
                console.error("generate stream error:", err);
                controller.enqueue(
                  encoder.encode(`${STATUS_PREFIX}incomplete:stream-error${STATUS_SUFFIX}`),
                );
                controller.close();
              }
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
