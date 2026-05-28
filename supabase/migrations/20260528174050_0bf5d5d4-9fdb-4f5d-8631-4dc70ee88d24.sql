
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS title TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sites_subdomain_unique ON public.sites (lower(subdomain)) WHERE subdomain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sites_project_user_unique ON public.sites (user_id, project_id);

GRANT SELECT ON public.sites TO anon;

DROP POLICY IF EXISTS "Anyone can view published sites" ON public.sites;
CREATE POLICY "Anyone can view published sites"
ON public.sites
FOR SELECT
TO anon
USING (subdomain IS NOT NULL AND html_content IS NOT NULL);
