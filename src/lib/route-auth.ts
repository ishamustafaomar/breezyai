// Bearer-token auth helper for server route handlers (NOT createServerFn).
// The auto-generated requireSupabaseAuth middleware only works for server
// functions, so we mirror its logic here for use in src/routes/api/* handlers.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; response: Response };

export async function requireBearerUser(request: Request): Promise<AuthResult> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      ok: false,
      response: jsonError("Server is missing Supabase credentials", 500),
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }
  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return { ok: false, response: jsonError("Unauthorized", 401) };

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }
  return { ok: true, userId: data.claims.sub as string, token };
}

export function jsonOk<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
