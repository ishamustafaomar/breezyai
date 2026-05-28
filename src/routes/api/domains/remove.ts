import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonError, jsonOk, requireBearerUser } from "@/lib/route-auth";

export const Route = createFileRoute("/api/domains/remove")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireBearerUser(request);
        if (!auth.ok) return auth.response;

        let body: { projectId?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonError("Invalid JSON body");
        }
        const projectId = (body.projectId || "").trim();
        if (!projectId) return jsonError("projectId is required");

        const { error } = await supabaseAdmin
          .from("sites")
          .update({
            custom_domain: null,
            domain_verification_token: null,
            domain_verified: false,
            domain_verified_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("project_id", projectId)
          .eq("user_id", auth.userId);
        if (error) {
          console.error("[domains/remove] error", error);
          return jsonError("Couldn't remove domain — try again", 500);
        }

        return jsonOk({ ok: true });
      },
    },
  },
});
