import { supabase } from "@/integrations/supabase/client";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "site";
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 7);
}

export type PublishResult = {
  subdomain: string;
  url: string; // path-based public URL
};

/** Publish (or re-publish) a project's HTML under a unique subdomain. */
export async function publishProject(opts: {
  projectId: string;
  name: string;
  html: string;
}): Promise<PublishResult> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("You must be signed in to publish.");
  const userId = userData.user.id;

  // Reuse existing subdomain if a site row exists for this project
  const { data: existing } = await supabase
    .from("sites")
    .select("id, subdomain")
    .eq("user_id", userId)
    .eq("project_id", opts.projectId)
    .maybeSingle();

  let subdomain = existing?.subdomain ?? "";
  if (!subdomain) {
    const base = slugify(opts.name);
    // Try base, then base-xxxxx; if collision, retry a few times.
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? base : `${base}-${shortId()}`;
      const { data: hit } = await supabase
        .from("sites")
        .select("id")
        .ilike("subdomain", candidate)
        .maybeSingle();
      if (!hit) {
        subdomain = candidate;
        break;
      }
    }
    if (!subdomain) subdomain = `${base}-${shortId()}${shortId()}`;
  }

  const payload = {
    user_id: userId,
    project_id: opts.projectId,
    subdomain,
    title: opts.name,
    html_content: opts.html,
    last_deployed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from("sites").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("sites").insert(payload);
    if (error) throw new Error(error.message);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return { subdomain, url: `${origin}/s/${subdomain}` };
}

export async function getPublishedSubdomain(projectId: string): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data } = await supabase
    .from("sites")
    .select("subdomain")
    .eq("user_id", userData.user.id)
    .eq("project_id", projectId)
    .maybeSingle();
  return data?.subdomain ?? null;
}
