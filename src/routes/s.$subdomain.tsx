import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const getPublishedSite = createServerFn({ method: "GET" })
  .inputValidator((d: { subdomain: string }) =>
    z.object({ subdomain: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/i) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("sites")
      .select("html_content, title, subdomain")
      .ilike("subdomain", data.subdomain)
      .not("html_content", "is", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.html_content) return null;
    return { html: row.html_content, title: row.title ?? row.subdomain };
  });

export const Route = createFileRoute("/s/$subdomain")({
  loader: async ({ params }) => {
    const site = await getPublishedSite({ data: { subdomain: params.subdomain } });
    if (!site) throw notFound();
    return site;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ? `${loaderData.title} — Breezy` : "Breezy site" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-3xl font-bold mb-2">Site not found</h1>
        <p className="text-muted-foreground">This subdomain hasn't been published yet.</p>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-8 text-center">
      <div>
        <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground">Try again in a moment.</p>
      </div>
    </div>
  ),
  component: PublishedSitePage,
});

function PublishedSitePage() {
  const { html } = Route.useLoaderData();
  return (
    <iframe
      title="Published site"
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
      className="fixed inset-0 w-screen h-screen border-0"
    />
  );
}
