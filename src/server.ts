import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { isBreezyHost } from "./lib/domain-utils";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

async function lookupCustomDomain(host: string): Promise<{ projectId: string } | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/sites?custom_domain=eq.${encodeURIComponent(
      host,
    )}&domain_verified=eq.true&select=project_id&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { project_id: string }[];
    return rows[0] ? { projectId: rows[0].project_id } : null;
  } catch (e) {
    console.error("[customDomain] lookup failed", e);
    return null;
  }
}

function customDomainPage(host: string, projectId: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${host}</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:grid;place-items:center;padding:24px}.card{max-width:520px;text-align:center}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#34d399;margin-right:8px;vertical-align:middle}h1{font-size:28px;margin:0 0 12px}p{color:#94a3b8;line-height:1.6}code{background:#1e293b;padding:2px 8px;border-radius:6px;font-size:13px}</style></head><body><div class="card"><h1><span class="dot"></span>${host} is connected</h1><p>This domain is wired to a Breezy project (<code>${projectId.slice(0, 12)}…</code>). Publish a new version from the Breezy builder to see it appear here.</p></div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function unknownDomainPage(host: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Domain not connected</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:grid;place-items:center;padding:24px}.card{max-width:520px;text-align:center}h1{font-size:32px;margin:0 0 12px}p{color:#94a3b8;line-height:1.6}a{color:#fb923c;text-decoration:none;font-weight:600}</style></head><body><div class="card"><h1>This domain isn't connected to a Breezy site yet.</h1><p><code>${host}</code> doesn't have a verified Breezy project.<br/>If it's yours, finish setup in the <a href="https://breezy.app">Breezy builder</a>.</p></div></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Custom-domain routing: any host that isn't ours gets looked up in Supabase.
      const host = (request.headers.get("host") || "").toLowerCase().split(":")[0];
      if (host && !isBreezyHost(host)) {
        const match = await lookupCustomDomain(host);
        return match ? customDomainPage(host, match.projectId) : unknownDomainPage(host);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
