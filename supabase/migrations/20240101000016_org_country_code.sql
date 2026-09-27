ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'CO';
