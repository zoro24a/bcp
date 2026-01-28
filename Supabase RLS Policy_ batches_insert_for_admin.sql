CREATE POLICY "Admins can insert batches"
ON public.batches FOR INSERT TO authenticated WITH CHECK (
  (EXISTS ( SELECT 1 FROM public.profiles WHERE (profiles.id = auth.uid() AND profiles.role = 'admin')))
);