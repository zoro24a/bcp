-- SQL Migration: Add missing columns for Internship and Passport requests

-- 1. Add company_block to requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS company_block TEXT;

-- 2. Add duration_block to requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS duration_block TEXT;

-- 3. Add specialization_snapshot to requests table (renamed from specialization)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS specialization_snapshot TEXT;

-- 4. Add resubmission_count to requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS resubmission_count INT DEFAULT 0;

-- 5. Add certificate_number to requests table (Ensure it exists!)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS certificate_number TEXT;

-- Optional: Add comments to new columns
COMMENT ON COLUMN public.requests.company_block IS 'Name of the company/organization for internship/passport requests';
COMMENT ON COLUMN public.requests.duration_block IS 'Internship duration or specific dates';
COMMENT ON COLUMN public.requests.specialization_snapshot IS 'Snapshot of the student specialization at the time of request';
COMMENT ON COLUMN public.requests.resubmission_count IS 'Number of times this request has been returned and resubmitted';
COMMENT ON COLUMN public.requests.certificate_number IS 'Final issued certificate serial number (e.g., ACE/BC/2026/0001)';

-- 5. Force schema cache refresh (PostgREST handles this automatically but this note is for user)
-- If the error persists, you can try running: 
-- NOTIFY pgrst, 'reload schema';
