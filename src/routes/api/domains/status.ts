import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonError, jsonOk, requireBearerUser } from "@/lib/route-auth";

export const Route = createFileRoute("/api/domains/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireBearerUser(request);
        if (!auth.ok) return auth.response;

        const url = new URL(request.url);
        const projectId = (url.searchParams.get("projectId") || "").trim();
        if (!projectId) return jsonError("projectId is required");

        const { data, error } = await supabaseAdmin
          .from("sites")
          .select("*")
          .eq("project_id", projectId)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (error) {
          console.error("[domains/status] error", error);
          return jsonError("Couldn't load site — try again", 500);
        }

        return jsonOk({ site: data ?? null });
      },
    },
  },
});
