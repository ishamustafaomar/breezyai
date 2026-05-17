import { createFileRoute } from "@tanstack/react-router";

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

const STATUS_PREFIX = "<!--BREEZY_GENERATION_STATUS:";
const STATUS_SUFFIX = ":BREEZY_GENERATION_STATUS-->";

/** ~28k chars for chat turns; leaves room for system prompt + currentHtml + completion. */
const MAX_CONTEXT_CHARS = 28_000;
const KEEP_RECENT_MESSAGES = 12;

const SYSTEM_PROMPT = `You are Breezy's site generator — a senior product designer and frontend engineer. Ship studio-quality, fully responsive marketing pages and simple web apps that look like they came from a funded startup (Linear, Vercel, Stripe tier), not an AI template.

═══ OUTPUT FORMAT (non-negotiable) ═══
- Return ONLY raw HTML. No markdown, no code fences (\`\`\`), no preamble, no explanation before or after.
- Start with <!DOCTYPE html> and end with </html>. Every tag must be properly closed.
- Always include in <head>:
  • <meta charset="UTF-8">
  • <meta name="viewport" content="width=device-width, initial-scale=1">
  • A specific <title> and <meta name="description" content="…">
  • <script src="https://cdn.tailwindcss.com"></script> (required — never omit)
  • Immediately after: <script>tailwind.config = { theme: { extend: { … } } }</script> with real tokens
- Use Google Fonts with preconnect for a display + body pairing wired into tailwind.config fontFamily.

═══ TAILWIND CSS (strict usage) ═══
- Use Tailwind utility classes for ALL layout, spacing, color, and typography. Avoid one-off inline styles except rare cases (e.g. complex gradients).
- Mobile-first breakpoints: base styles for 320–480px, then sm:, md:, lg:, xl: as needed.
- Consistent spacing scale: prefer gap-*, space-y-*, p-6/p-8/p-12/p-16/p-20, max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 on sections.
- Cohesive color palette via tailwind.config extend.colors — 1 brand accent, 1 secondary, neutral ramp (zinc/stone/slate). Never default blue-500 + gray-900.
- Typography hierarchy: one display treatment for h1/h2 (tracking-tight, text-4xl sm:text-5xl md:text-6xl lg:text-7xl on hero), body text-base/text-lg with text-muted tones (e.g. text-zinc-500), consistent font weights.
- Cards: rounded-2xl/3xl, borders, shadows, hover: transitions. Buttons: rounded-xl, focus-visible:ring-2 focus-visible:ring-offset-2.

═══ RESPONSIVE & ACCESSIBLE HTML ═══
- Semantic landmarks: <header>, <nav>, <main>, <section> with aria-labelledby or visible headings, <footer>.
- One <h1> per page; logical heading order. aria-label on icon-only controls; aria-hidden on decorative SVGs.
- Sufficient color contrast. Visible focus states. Nav collapses to mobile menu (hamburger) below md:.
- Test layout at 380px, 768px, 1280px — no horizontal overflow, readable type, tappable targets (min ~44px).

═══ DESIGN QUALITY ═══
- Pick ONE intentional aesthetic matching the user's idea; commit fully.
- Hero: strong headline, subhead, dual CTAs, trust element, custom visual (CSS/SVG mock UI, blobs — no external images).
- 6–9 sections as appropriate: nav, hero, logos/features/bento, social proof, pricing/FAQ, CTA, footer.
- Copy: specific, on-brand, zero lorem ipsum. Inline 24×24 stroke SVG icons (consistent style).
- Imagery: CSS gradients, div-built UIs, inline SVG only — NO unsplash, placeholder.com, or hotlinked images.

═══ EDIT MODE (when current HTML is provided) ═══
- You are PATCHING an existing page, not starting over.
- Read the full conversation to understand what the user wants changed.
- Modify ONLY the sections, components, classes, or copy relevant to the request.
- Preserve everything else: structure, IDs, class naming patterns, palette, fonts, unrelated sections, and working scripts.
- If they say "darker", "add pricing", "fix hero" — touch only that scope; merge changes into the existing document.
- Output the COMPLETE updated HTML document (entire file), not a fragment.

═══ INTERACTIVITY (static sandbox — no backend) ═══
- No fetch(), XHR, WebSocket, or real OAuth. Forms/auth/waitlist: vanilla JS + localStorage at end of <body>, e.preventDefault(), UI updates in place.
- Mobile menu, FAQ <details>, modals, tabs: wire in one self-contained <script> (IIFE or DOMContentLoaded), null-safe querySelectors.

═══ BEFORE YOU FINISH ═══
1. Tailwind CDN present in <head>? 2. All tags closed? 3. Mobile-first responsive? 4. Edit preserved unrelated content?
5. Ends with </body></html>. Quality over brevity — deliver a complete, polished document.`;

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

/** Trim or condense history so follow-up edits retain intent without blowing the context window. */
function prepareConversationHistory(messages: GatewayMessage[]): GatewayMessage[] {
  const sanitized = sanitizeMessages(messages);
  if (charTotal(sanitized) <= MAX_CONTEXT_CHARS) return sanitized;

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

  if (charTotal(condensed) <= MAX_CONTEXT_CHARS) return condensed;

  // Still too large — progressively shorten oldest non-anchor content
  const trimmed = [...condensed];
  while (charTotal(trimmed) > MAX_CONTEXT_CHARS && trimmed.length > 3) {
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
          const conversation = prepareConversationHistory(messages ?? []);
          const finalUserPrompt = isEdit
            ? `CURRENT SITE HTML — apply a surgical edit; do NOT rewrite the whole page unless the user explicitly asked for a full redesign:\n\n${currentHtml}\n\nInstructions:
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
                max_completion_tokens: 48000,
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
                while (attempts < 3 && lastFinishReason === "length" && !emittedAll.toLowerCase().includes("</html>")) {
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
                  const next = await callGateway(continueMessages);
                  if (!next.ok || !next.body) break;
                  lastFinishReason = await consume(next);
                }

                const complete =
                  emittedContent &&
                  emittedAll.toLowerCase().includes("</html>") &&
                  (lastFinishReason === "" || lastFinishReason === "stop");
                const status = complete ? "complete" : `incomplete:${lastFinishReason || "no-content"}`;
                controller.enqueue(encoder.encode(`${STATUS_PREFIX}${status}${STATUS_SUFFIX}`));
                controller.close();
              } catch (err) {
                console.error("generate stream error:", err);
                controller.enqueue(encoder.encode(`${STATUS_PREFIX}incomplete:stream-error${STATUS_SUFFIX}`));
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
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
