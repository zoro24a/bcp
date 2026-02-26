-- Add return reason columns to ensure remarks are not overwritten
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS tutor_return_reason TEXT,
ADD COLUMN IF NOT EXISTS hod_return_reason TEXT,
ADD COLUMN IF NOT EXISTS principal_return_reason TEXT;

-- Verify columns were added (optional)
COMMENT ON COLUMN public.requests.tutor_return_reason IS 'Remark provided by Tutor when returning to Student';
COMMENT ON COLUMN public.requests.hod_return_reason IS 'Remark provided by HOD when returning to Tutor';
COMMENT ON COLUMN public.requests.principal_return_reason IS 'Remark provided by Principal when returning to HOD';

-- Refresh the PostgREST schema cache (Supabase does this automatically usually, 
-- but you can run NOTIFY pgrst, 'reload schema' if needed)
