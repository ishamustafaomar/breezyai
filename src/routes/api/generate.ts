import { createFileRoute } from "@tanstack/react-router";

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

const STATUS_PREFIX = "<!--BREEZY_GENERATION_STATUS:";
const STATUS_SUFFIX = ":BREEZY_GENERATION_STATUS-->";

/** Chat-turn budget; reduced when currentHtml is large to avoid context overflow. */
const MAX_CONTEXT_CHARS = 28_000;
const MAX_CONTEXT_CHARS_WITH_HTML = 10_000;
const MAX_CURRENT_HTML_CHARS = 48_000;
const KEEP_RECENT_MESSAGES = 12;

const SYSTEM_PROMPT = `You are Breezy's site generator — a senior product designer and frontend engineer. Ship studio-quality, fully responsive marketing pages that look like a funded startup (Linear, Vercel, Stripe tier), not an AI template.

═══ OUTPUT FORMAT (non-negotiable) ═══
- Return ONLY raw HTML. No markdown, no code fences (\`\`\`), no preamble, no explanation.
- Start with <!DOCTYPE html>, end with </html>. Every tag properly closed.
- <head> must include: charset, viewport meta, title, description, <script src="https://cdn.tailwindcss.com"></script>, tailwind.config script, Google Fonts preconnect, and a rich <style> block (see below).
- Enable class-based dark mode: tailwind.config must include darkMode: 'class'.

═══ COLOR PALETTE (:root scale — required) ═══
- In <style>, define a full brand scale as CSS custom properties: --brand-50 through --brand-900 (cohesive hue).
- Wire these into tailwind.config extend.colors as brand-50…brand-900.
- Use consistently: brand-600 for primary CTAs, brand-50 for tinted section backgrounds, brand-900 for headings.
- Never use arbitrary inline hex colors — only the brand scale + Tailwind neutrals.

═══ TYPOGRAPHY RHYTHM (strict scale) ═══
- Hero headlines: text-5xl sm:text-6xl md:text-7xl (one display size per breakpoint).
- Section headings: text-3xl md:text-4xl. Subheadings: text-2xl.
- Body: text-base or text-lg with leading-relaxed (line-height ~1.7) always.
- Paragraphs: max-w-prose mx-auto where appropriate. Subheadings: mt-12 mb-4. Never cramped body copy.

═══ STICKY NAV WITH BLUR (required) ═══
- Navbar: sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-800/50.
- Moon/sun toggle in nav toggles class="dark" on <html>.
- Default theme from system: if(window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark')
- Scroll listener: after window.scrollY > 50, add a shadow class (e.g. shadow-md) to the nav; remove below 50.

═══ DARK MODE (required) ═══
- Full dark: variant support via Tailwind dark: classes on all major surfaces, text, borders, cards, nav, footer.
- Persist optional: localStorage theme key + respect system preference on first load.

═══ SCROLL ANIMATIONS (required) ═══
- Every section below the hero gets class="reveal" for scroll-reveal.
- In <style> include:
  .reveal { opacity:0; transform:translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease }
  .reveal.visible { opacity:1; transform:none }
- In closing <script>, always use Intersection Observer:
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible') })
  }, { threshold: 0.15 })
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el))

═══ SVG HERO ILLUSTRATIONS (required — no blob placeholders) ═══
- Never use simple geometric gradient blobs as the hero visual.
- Always build a detailed, layered inline SVG hero: 8–12+ distinct path/group elements, line-art or isometric style, topic-related shapes, depth layers, subtle drop shadows via SVG filters (<filter> feDropShadow).
- Alternatively (or additionally) use realistic photos: https://images.unsplash.com/photo-[relevant-id]?w=800&q=80 with topic-appropriate Unsplash IDs, object-cover on containers. Never colored blob placeholders.

═══ BENTO GRID (required for features) ═══
- Replace generic 3-column cards with a bento layout: CSS grid grid-template-columns: repeat(12, 1fr) with mixed spans — e.g. col-span-7 + col-span-5, then col-span-4 × 3.
- Each cell: unique background tint (brand-50/100), icon, heading, 1–2 line description.

═══ SOCIAL PROOF / TESTIMONIALS (required) ═══
- Grid of at least 3 testimonial cards: colored avatar circles with initials, realistic full names + company names (never "John Doe"), 5-star inline SVG ratings, <blockquote> formatting.

═══ RICH FOOTER (required) ═══
- Never a thin one-line footer. Always: 4 columns (Product, Company, Resources, Newsletter signup), social icons (X/Twitter, GitHub, LinkedIn) as inline SVGs, copyright, tagline, subtle top border.

═══ MICRO-INTERACTIONS (required classes) ═══
- Buttons: hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all duration-150
- Cards: hover:-translate-y-1 hover:shadow-xl transition-all duration-200
- Links: underline-offset-4 hover:underline transition
- Icons: hover:scale-110 transition-transform

═══ JAVASCRIPT (required in one closing <script>) ═══
- Intersection Observer scroll-reveal (above).
- Animated stat counters: count from 0 to target when element enters viewport (Intersection Observer).
- Smooth anchor scroll: document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth'}) }))
- Mobile menu: slide-down with max-height transition (not instant display toggle).
- Tab switcher with animated underline indicator on the active tab.
- Dark mode toggle + nav scroll shadow (above).
- No fetch/XHR/real OAuth. Forms: localStorage + e.preventDefault(). Null-safe querySelectors, IIFE or DOMContentLoaded.

═══ RESPONSIVE & ACCESSIBLE HTML ═══
- Semantic landmarks, one <h1>, aria-labels on icon buttons, mobile hamburger nav, contrast + focus rings.
- Mobile-first: 380px, 768px, 1280px — no horizontal overflow.

═══ EDIT MODE (when current HTML is provided) ═══
- PATCH surgically — modify only what the user asked; preserve palette, scripts, unrelated sections.
- Output the COMPLETE updated document.

═══ BEFORE YOU FINISH ═══
Tailwind CDN, :root brand scale, dark mode, sticky blur nav, reveal animations, bento grid, 3+ testimonials, rich footer, hero SVG or Unsplash, all JS wired, </html> closed.`;

function sanitizeMessages(messages: GatewayMessage[]): GatewayMessage[] {
  return messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
    .map((m) => ({ role: m.role, content: m.content.trim() }));
}

function summarizeMessages(messages: GatewayMessage[]): string {
  return messages
    .map((m) => {
      const prefix = m.role === "user" ? "User" : "Assistant";
      const body = m.content.length > 280 ? `${m.content.slice(0, 280)}…` : m.content;
      return `${prefix}: ${body}`;
    })
    .join("\n");
}

function charTotal(messages: GatewayMessage[]): number {
  return messages.reduce((n, m) => n + m.content.length, 0);
}

function truncateCurrentHtml(html: string): string {
  if (html.length <= MAX_CURRENT_HTML_CHARS) return html;
  return `${html.slice(0, MAX_CURRENT_HTML_CHARS)}\n<!-- HTML truncated for context; preserve structure when editing -->`;
}

/** Trim or condense history so follow-up edits retain intent without blowing the context window. */
function prepareConversationHistory(messages: GatewayMessage[], currentHtmlLen = 0): GatewayMessage[] {
  const sanitized = sanitizeMessages(messages);
  const budget = currentHtmlLen > 12_000 ? MAX_CONTEXT_CHARS_WITH_HTML : MAX_CONTEXT_CHARS;
  if (charTotal(sanitized) <= budget) return sanitized;

  const firstUserIdx = sanitized.findIndex((m) => m.role === "user");
  const anchor = firstUserIdx >= 0 ? sanitized[firstUserIdx] : sanitized[0];
  const recent = sanitized.slice(-KEEP_RECENT_MESSAGES);
  const middleEnd = sanitized.length - KEEP_RECENT_MESSAGES;
  const middleStart = firstUserIdx >= 0 ? firstUserIdx + 1 : 1;
  const middle = middleEnd > middleStart ? sanitized.slice(middleStart, middleEnd) : [];

  const condensed: GatewayMessage[] = [anchor];
  if (middle.length > 0) {
    condensed.push({
      role: "user",
      content: `[Earlier conversation — ${middle.length} messages condensed for context]\n${summarizeMessages(middle)}`,
    });
  }
  for (const m of recent) {
    if (m !== anchor) condensed.push(m);
  }

  if (charTotal(condensed) <= budget) return condensed;

  // Still too large — progressively shorten oldest non-anchor content
  const trimmed = [...condensed];
  while (charTotal(trimmed) > budget && trimmed.length > 3) {
    const idx = trimmed.findIndex((m, i) => i > 0 && m.role === "assistant" && m.content.length > 400);
    if (idx === -1) break;
    const m = trimmed[idx];
    trimmed[idx] = {
      ...m,
      content: `${m.content.slice(0, 350)}… [trimmed for length]`,
    };
  }
  return trimmed;
}

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
            return new Response(JSON.stringify({ error: "AI is not configured (LOVABLE_API_KEY missing)" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const isEdit = !!(currentHtml && currentHtml.length > 200);
          const htmlForPrompt = currentHtml ? truncateCurrentHtml(currentHtml) : undefined;
          const conversation = prepareConversationHistory(messages ?? [], htmlForPrompt?.length ?? 0);
          const finalUserPrompt = isEdit
            ? `CURRENT SITE HTML — apply a surgical edit; do NOT rewrite the whole page unless the user explicitly asked for a full redesign:\n\n${htmlForPrompt}\n\nInstructions:
- Use the conversation above to understand exactly what to change.
- Modify ONLY the relevant sections, styles, or copy. Keep all unrelated markup, classes, scripts, and structure intact.
- Output the full updated HTML document. Raw HTML only — no markdown, no code fences, no commentary.`
            : `Generate the complete HTML document for this project based on the conversation above.

Requirements: studio-quality responsive layout, Tailwind CDN in <head>, semantic accessible HTML, real on-topic copy, 6–9 sections as appropriate. Raw HTML only — no markdown, no fences. End with </html>.`;

          const baseMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversation,
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
                model: "openai/gpt-5",
                stream: true,
                max_completion_tokens: 24000,
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

          let streamClosed = false;

          const closeStream = (controller: ReadableStreamDefaultController<Uint8Array>, status: string) => {
            if (streamClosed) return;
            streamClosed = true;
            try {
              controller.enqueue(encoder.encode(`${STATUS_PREFIX}${status}${STATUS_SUFFIX}`));
              controller.close();
            } catch {
              /* already closed */
            }
          };

          const stream = new ReadableStream({
            async start(controller) {
              const abortHandler = () => {
                closeStream(controller, "incomplete:aborted");
              };
              request.signal.addEventListener("abort", abortHandler, { once: true });

              const consume = async (resp: Response): Promise<string> => {
                if (!resp.body) return "";
                const reader = resp.body.getReader();
                let buf = "";
                let finishReason = "";

                const processLine = (line: string) => {
                  if (request.signal.aborted) return;
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
                  } catch (parseErr) {
                    console.warn("generate SSE parse skip:", parseErr);
                  }
                };

                try {
                  while (true) {
                    if (request.signal.aborted) break;
                    let readResult: ReadableStreamReadResult<Uint8Array>;
                    try {
                      readResult = await reader.read();
                    } catch (readErr) {
                      console.error("generate stream read error:", readErr);
                      throw readErr;
                    }
                    const { value, done } = readResult;
                    if (done) {
                      if (buf.trim()) processLine(buf);
                      break;
                    }
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() ?? "";
                    for (const line of lines) processLine(line);
                  }
                } finally {
                  try {
                    reader.releaseLock();
                  } catch {
                    /* ignore */
                  }
                }
                return finishReason;
              };

              try {
                if (request.signal.aborted) {
                  closeStream(controller, "incomplete:aborted");
                  return;
                }

                lastFinishReason = await consume(upstream);

                // Auto-continue up to 6 times if we hit length cap without finishing the doc.
                let attempts = 0;
                while (
                  !request.signal.aborted &&
                  attempts < 6 &&
                  (lastFinishReason === "length" || (lastFinishReason === "stop" && !emittedAll.toLowerCase().includes("</html>"))) &&
                  !emittedAll.toLowerCase().includes("</html>")
                ) {
                  attempts++;
                  const continueMessages = [
                    { role: "system" as const, content: SYSTEM_PROMPT },
                    ...conversation,
                    { role: "user" as const, content: finalUserPrompt },
                    { role: "assistant" as const, content: emittedAll },
                    {
                      role: "user" as const,
                      content:
                        "Continue the HTML document EXACTLY where you left off. Do not repeat any prior content, do not add commentary or fences. Output only the remaining HTML and end with </html>.",
                    },
                  ];
                  let next: Response;
                  try {
                    next = await callGateway(continueMessages);
                  } catch (fetchErr) {
                    console.error("generate continue fetch error:", fetchErr);
                    break;
                  }
                  if (!next.ok || !next.body) {
                    console.error("generate continue failed:", next.status);
                    break;
                  }
                  try {
                    lastFinishReason = await consume(next);
                  } catch (continueErr) {
                    console.error("generate continue stream error:", continueErr);
                    break;
                  }
                }

                if (request.signal.aborted) {
                  closeStream(controller, "incomplete:aborted");
                  return;
                }

                const lower = emittedAll.toLowerCase();
                const hasDoctype = lower.includes("<!doctype") || lower.includes("<html");
                const hasHtmlClose = lower.includes("</html>");

                // Salvage: if we have a real document but it never closed, append closing tags
                // so the user gets a usable site instead of losing the whole generation.
                if (emittedContent && hasDoctype && !hasHtmlClose && emittedAll.length > 2000) {
                  const tail: string[] = [];
                  if (!lower.includes("</body>")) tail.push("\n</body>");
                  tail.push("\n</html>");
                  const salvage = tail.join("");
                  emittedAll += salvage;
                  controller.enqueue(encoder.encode(salvage));
                  closeStream(controller, "complete");
                  return;
                }

                const complete =
                  emittedContent &&
                  hasHtmlClose &&
                  (lastFinishReason === "" || lastFinishReason === "stop");
                closeStream(controller, complete ? "complete" : `incomplete:${lastFinishReason || "no-content"}`);
              } catch (err) {
                console.error("generate stream error:", err);
                closeStream(controller, "incomplete:stream-error");
              } finally {
                request.signal.removeEventListener("abort", abortHandler);
              }
            },
            cancel() {
              streamClosed = true;
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
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
