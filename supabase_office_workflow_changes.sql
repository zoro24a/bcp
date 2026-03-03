-- 1. Add issued_at column to requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;

-- 2. Update RLS policies for the 'office' role
-- Note: Replace existing policies or add these if they don't exist.

-- Allow Office to view requests ready for issue
CREATE POLICY "Office can view requests ready for issue"
ON public.requests
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role' = 'office' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'office')
  AND status IN ('Ready for Issue', 'Issued')
);

-- Allow Office to update requests to 'Issued'
CREATE POLICY "Office can update requests to Issued"
ON public.requests
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'role' = 'office' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'office')
  AND status = 'Ready for Issue'
)
WITH CHECK (
  status = 'Issued'
);
