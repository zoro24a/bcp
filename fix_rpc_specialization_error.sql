-- SQL Fix: Resolve 'column specialization does not exist' error in issue_certificate RPC

-- 1. Add specialization column back to requests table
-- This is required because the issue_certificate RPC function references this column.
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS specialization TEXT;

-- 2. Optional: Populate specialization from specialization_snapshot for existing rows
UPDATE public.requests 
SET specialization = specialization_snapshot 
WHERE specialization IS NULL AND specialization_snapshot IS NOT NULL;

-- 3. Comment for clarity
COMMENT ON COLUMN public.requests.specialization IS 'Mirrors specialization_snapshot to satisfy legacy RPC dependencies';

-- 4. Notify to reload schema (optional but helpful)
-- NOTIFY pgrst, 'reload schema';
