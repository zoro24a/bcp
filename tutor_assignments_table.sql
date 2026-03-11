-- ==========================================
-- Create tutor_assignments table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.tutor_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  section VARCHAR NOT NULL,
  semester INTEGER NOT NULL,
  tutor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  academic_year VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(batch_id, section, semester)
);

-- RLS Policies
ALTER TABLE public.tutor_assignments ENABLE ROW LEVEL SECURITY;

-- 1. Admin can do everything
CREATE POLICY "Admins can do everything on tutor_assignments"
ON public.tutor_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Students can view tutor_assignments (for request routing resolution)
CREATE POLICY "Students can view tutor_assignments"
ON public.tutor_assignments
FOR SELECT
TO authenticated
USING (true);

-- 3. Tutors and HODs can view tutor_assignments
CREATE POLICY "Tutors and HODs can view tutor_assignments"
ON public.tutor_assignments
FOR SELECT
TO authenticated
USING (true);
