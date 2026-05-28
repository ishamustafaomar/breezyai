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

═══ CLARIFY MODE (use sparingly, BEFORE generating HTML) ═══
- If the user's request is genuinely ambiguous and you cannot make a reasonable guess (e.g. "build something cool", "make me an app", no topic given), DO NOT generate HTML. Instead output EXACTLY one line:
  <!--BREEZY_CLARIFY:Question one?|Question two?|Question three?-->
- Use 2–4 short, concrete questions separated by "|". No other text. Stop immediately after the marker.
- If the request is clear enough to attempt (even loosely), DO NOT clarify — just build. Default to building.

═══ OUTPUT FORMAT (non-negotiable) ═══
- Return ONLY raw HTML. No markdown, no code fences (\`\`\`), no preamble, no explanation.
- Start with <!DOCTYPE html>, end with </html>. Every tag properly closed.
- <head> must include: charset, viewport meta, title, description, <script src="https://cdn.tailwindcss.com"></script>, tailwind.config script, Google Fonts preconnect, and a rich <style> block.
- Enable class-based dark mode: tailwind.config must include darkMode: 'class'.

═══ IMAGES (CRITICAL — they MUST load) ═══
- NEVER use Unsplash URLs with placeholder IDs (https://images.unsplash.com/photo-XXX). Those broke and showed gray boxes.
- ONLY use ONE of these for raster images:
  1) https://picsum.photos/seed/{kebab-keyword}/{w}/{h}  — always loads, deterministic per seed (e.g. https://picsum.photos/seed/bakery-hero/1200/800)
  2) Inline SVG (preferred for icons, illustrations, logos, avatars)
- For hero illustrations and feature icons, prefer rich inline SVG (8+ paths, layered shapes, subtle gradients, drop shadows via <filter><feDropShadow/></filter>). Never use plain gradient blobs as the hero.
- For testimonial avatars, use colored circles with initials in inline SVG — NOT external image URLs.
- Always add object-cover + explicit width/height/aspect classes to <img> so layout never collapses.
- Every <img> must have alt text and a width/height or aspect-[w/h] class to prevent layout shift.

═══ COLOR PALETTE (:root scale — required) ═══
- In <style>, define a full brand scale as CSS custom properties: --brand-50 through --brand-900 (cohesive hue).
- Wire these into tailwind.config extend.colors as brand-50…brand-900.
- Use consistently: brand-600 for primary CTAs, brand-50 for tinted section backgrounds, brand-900 for headings.
- Never use arbitrary inline hex colors — only the brand scale + Tailwind neutrals.

═══ TYPOGRAPHY RHYTHM ═══
- Hero headlines: text-5xl sm:text-6xl md:text-7xl. Section headings: text-3xl md:text-4xl. Body: text-base or text-lg with leading-relaxed.
- Paragraphs: max-w-prose where appropriate. Never cramped copy.

═══ STICKY NAV WITH BLUR + DARK MODE TOGGLE ═══
- sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-800/50.
- Moon/sun toggle in nav toggles class="dark" on <html>; default from prefers-color-scheme; persist via localStorage.
- After scrollY > 50, add shadow-md to nav.

═══ SCROLL ANIMATIONS ═══
- Every section below hero gets class="reveal".
- .reveal { opacity:0; transform:translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease }
- .reveal.visible { opacity:1; transform:none }
- IntersectionObserver toggles .visible at threshold 0.15.

═══ REQUIRED SECTIONS ═══
- Bento grid features (CSS grid 12 cols, mixed col-spans, brand-tinted cells).
- 3+ testimonial cards with initial-avatar SVGs, realistic names + companies, 5-star SVG ratings, <blockquote>.
- Rich 4-column footer (Product, Company, Resources, Newsletter), inline SVG social icons, copyright.

═══ MICRO-INTERACTIONS ═══
- Buttons: hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all duration-150
- Cards: hover:-translate-y-1 hover:shadow-xl transition-all duration-200

═══ JAVASCRIPT (one closing <script>) ═══
- IntersectionObserver scroll-reveal, animated stat counters, smooth anchor scroll, mobile menu (max-height transition), tab switcher, dark mode toggle + nav scroll shadow.
- No fetch/XHR/OAuth. Forms: e.preventDefault() + localStorage. Null-safe selectors. DOMContentLoaded wrapper.

═══ RESPONSIVE & ACCESSIBLE ═══
- Semantic landmarks, one <h1>, aria-labels on icon buttons, mobile hamburger, focus rings.
- Mobile-first; no horizontal overflow at 380px / 768px / 1280px.

═══ EDIT MODE (when CURRENT SITE HTML is provided) ═══
- This is a SURGICAL EDIT, not a rebuild. The user is iterating on an existing site.
- Output the COMPLETE updated document, but CHANGE ONLY what the user asked for. Preserve every other section, the palette, fonts, scripts, image URLs, copy, and structure byte-for-byte where unchanged.
- If the user says "change the hero copy to X" — only the hero copy changes. Nav, features, footer, scripts, styles: identical.
- If the user says "make it darker" — adjust the brand scale + dark surfaces. Layout and copy stay.
- Never silently drop sections. Never reorder unrelated sections. Never re-pick the palette unless asked.
- If you cannot identify what to change, use CLARIFY MODE instead of rebuilding from scratch.

═══ BEFORE YOU FINISH ═══
Tailwind CDN, brand scale, dark mode, sticky blur nav, reveal animations, bento grid, 3+ testimonials, rich footer, working images (picsum or SVG), all JS wired, </html> closed.`;


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
          const finalUserPrompt = isEdit
            ? `═══ SURGICAL EDIT ═══
The user is editing an EXISTING site. Below is the current HTML. Apply ONLY the change(s) from the most recent user message above. Preserve everything else exactly — palette, fonts, copy, images, scripts, sections, structure.

CURRENT SITE HTML:
${htmlForPrompt}

Rules:
- Re-output the COMPLETE document with only the requested change applied.
- DO NOT rewrite, redesign, reorder, or restyle anything the user did not ask about.
- DO NOT swap images, fonts, or palette unless explicitly asked.
- Raw HTML only — no markdown, no code fences, no commentary. End with </html>.`
            : `Generate the complete HTML document for this project based on the conversation above.

Requirements: studio-quality responsive layout, Tailwind CDN in <head>, semantic accessible HTML, real on-topic copy, 6–9 sections as appropriate, working images (picsum.photos seeds or inline SVG only — NO Unsplash). Raw HTML only — no markdown, no fences. End with </html>.

If the request is too vague to attempt, use CLARIFY MODE instead.`;

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
