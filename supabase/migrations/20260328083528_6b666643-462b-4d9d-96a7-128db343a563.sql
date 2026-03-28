CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  html text NOT NULL DEFAULT '<p></p>',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to templates"
  ON public.templates
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);