-- Shared updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Sites table
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL UNIQUE,
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  domain_verified BOOLEAN NOT NULL DEFAULT false,
  domain_verification_token TEXT,
  domain_verified_at TIMESTAMPTZ,
  last_deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by host for incoming request routing
CREATE INDEX idx_sites_custom_domain_verified
  ON public.sites (custom_domain)
  WHERE domain_verified = true;

-- Data API grants (auth-only table: all policies scope to auth.uid())
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;

-- RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sites"
  ON public.sites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sites"
  ON public.sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sites"
  ON public.sites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sites"
  ON public.sites FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_sites_updated_at
BEFORE UPDATE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();