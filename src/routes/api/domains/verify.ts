import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonError, jsonOk, requireBearerUser } from "@/lib/route-auth";
import { lookupTxt } from "@/lib/domain-utils";

export const Route = createFileRoute("/api/domains/verify")({
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

        const { data: site, error } = await supabaseAdmin
          .from("sites")
          .select("*")
          .eq("project_id", projectId)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (error) {
          console.error("[domains/verify] lookup error", error);
          return jsonError("Couldn't load site — try again", 500);
        }
        if (!site || !site.custom_domain || !site.domain_verification_token) {
          return jsonError("No custom domain to verify for this project", 404);
        }

        const host = `_breezy-verify.${site.custom_domain}`;
        let records: string[];
        try {
          records = await lookupTxt(host);
        } catch (e) {
          console.error("[domains/verify] DNS error", e);
          return jsonError(
            "Couldn't reach DNS servers — please try again in a moment",
            502,
          );
        }

        const found = records.some((r) => r.includes(site.domain_verification_token!));
        if (!found) {
          return jsonOk({
            verified: false,
            message:
              records.length === 0
                ? "No TXT record found yet — DNS can take up to 48 hours to propagate."
                : "We found TXT records but none matched. Double-check the value.",
            recordsFound: records.length,
          });
        }

        const { error: updErr } = await supabaseAdmin
          .from("sites")
          .update({
            domain_verified: true,
            domain_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", site.id);
        if (updErr) {
          console.error("[domains/verify] update error", updErr);
          return jsonError("Verified DNS but couldn't save — try again", 500);
        }

        return jsonOk({
          verified: true,
          message: `${site.custom_domain} is verified! Point a CNAME to your Breezy subdomain to finish routing.`,
        });
      },
    },
  },
});
