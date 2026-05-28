import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonError, jsonOk, requireBearerUser } from "@/lib/route-auth";
import { normalizeDomain, validationError } from "@/lib/domain-utils";

export const Route = createFileRoute("/api/domains/add")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireBearerUser(request);
        if (!auth.ok) return auth.response;

        let body: { projectId?: string; customDomain?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonError("Invalid JSON body");
        }
        const projectId = (body.projectId || "").trim();
        const customDomainRaw = (body.customDomain || "").trim();
        if (!projectId) return jsonError("projectId is required");

        const err = validationError(customDomainRaw);
        if (err) return jsonError(err);
        const customDomain = normalizeDomain(customDomainRaw);

        // Reject if another user already owns this domain.
        const { data: existing, error: existErr } = await supabaseAdmin
          .from("sites")
          .select("user_id, project_id")
          .eq("custom_domain", customDomain)
          .maybeSingle();
        if (existErr) {
          console.error("[domains/add] check error", existErr);
          return jsonError("Couldn't check domain availability — try again", 500);
        }
        if (existing && existing.user_id !== auth.userId) {
          return jsonError(
            "This domain is already connected to another Breezy project",
            409,
          );
        }

        const token = `breezy-verify-${crypto.randomUUID()}`;

        // Upsert by project_id. If the row exists (same user), overwrite domain fields.
        const { data, error } = await supabaseAdmin
          .from("sites")
          .upsert(
            {
              user_id: auth.userId,
              project_id: projectId,
              custom_domain: customDomain,
              domain_verification_token: token,
              domain_verified: false,
              domain_verified_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "project_id" },
          )
          .select()
          .single();
        if (error) {
          console.error("[domains/add] upsert error", error);
          if (error.code === "23505") {
            return jsonError(
              "This domain is already connected to another Breezy project",
              409,
            );
          }
          return jsonError("Couldn't save your domain — try again", 500);
        }

        return jsonOk({
          token,
          domain: customDomain,
          recordName: `_breezy-verify.${customDomain}`,
          site: data,
        });
      },
    },
  },
});
