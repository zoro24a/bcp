-- ========================================================
-- ROBUST Supabase RLS Fix using SECURITY DEFINER functions
-- ========================================================

-- 1. CLEANUP: Drop all potentially conflicting policies on requests
DROP POLICY IF EXISTS "Admin Select All" ON public.requests;
DROP POLICY IF EXISTS "Principal/Office Select All" ON public.requests;
DROP POLICY IF EXISTS "Student Select Own" ON public.requests;
DROP POLICY IF EXISTS "Faculty Select Departmental" ON public.requests;
DROP POLICY IF EXISTS "Admin Update All" ON public.requests;
DROP POLICY IF EXISTS "Principal Update Workflow" ON public.requests;
DROP POLICY IF EXISTS "HOD Update Workflow" ON public.requests;
DROP POLICY IF EXISTS "Tutor Update Workflow" ON public.requests;
DROP POLICY IF EXISTS "Student Update Workflow" ON public.requests;
DROP POLICY IF EXISTS "Faculty Update Workflow" ON public.requests;
DROP POLICY IF EXISTS "Admin/Principal Req Access" ON public.requests;
DROP POLICY IF EXISTS "Admin/Principal Select" ON public.requests;
DROP POLICY IF EXISTS "Student Req Access" ON public.requests;
DROP POLICY IF EXISTS "Faculty Req Select" ON public.requests;
DROP POLICY IF EXISTS "Faculty Req Update" ON public.requests;
DROP POLICY IF EXISTS "Unified select policy for requests workflow" ON public.requests;
DROP POLICY IF EXISTS "Unified update policy for requests workflow" ON public.requests;

-- 2. SECURE HELPER FUNCTIONS
-- Using SECURITY DEFINER allows these checks to run with elevated privileges, 
-- bypassing join issues where a user might not have SELECT access to metadata tables.

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'principal', 'office')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_dept_match(student_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.students s ON s.id = student_uuid
    JOIN public.batches b ON b.id = s.batch_id
    WHERE p.id = auth.uid() 
    AND p.department_id = b.department_id
    AND p.role IN ('hod', 'tutor')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. REQUEST TABLE POLICIES
-- --------------------------------------------------------

-- Admin/Principal: Full access
CREATE POLICY "Admin/Principal Req Access" ON public.requests 
FOR ALL TO authenticated 
USING (check_is_admin()) 
WITH CHECK (check_is_admin());

-- Student: View own, Update only if returned
CREATE POLICY "Student Req Select" ON public.requests 
FOR SELECT TO authenticated 
USING (student_id = auth.uid());

CREATE POLICY "Student Req Update" ON public.requests 
FOR UPDATE TO authenticated 
USING (student_id = auth.uid() AND status = 'Returned to Student')
WITH CHECK (student_id = auth.uid() AND status = 'Pending Tutor Approval');

-- Faculty (Tutor/HOD): View and Update within Department
CREATE POLICY "Faculty Req Select" ON public.requests 
FOR SELECT TO authenticated 
USING (check_dept_match(student_id));

CREATE POLICY "Faculty Req Update" ON public.requests 
FOR UPDATE TO authenticated 
USING (
  check_dept_match(student_id) AND (
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hod') AND status = 'Pending HOD Approval') OR
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tutor') AND status = 'Pending Tutor Approval')
  )
)
WITH CHECK (
  check_dept_match(student_id) AND (
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hod') AND status IN ('Pending Principal Approval', 'Returned to Tutor')) OR
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tutor') AND status IN ('Pending HOD Approval', 'Returned to Student'))
  )
);

-- 4. ENSURE METADATA ACCESSIBILITY
-- While the functions bypass these issues, it is still good practice to allow users to see their own metadata.
DROP POLICY IF EXISTS "Profiles read access" ON public.profiles;
CREATE POLICY "Profiles read access" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Batches read access" ON public.batches;
CREATE POLICY "Batches read access" ON public.batches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Students read access" ON public.students;
CREATE POLICY "Students read access" ON public.students FOR SELECT TO authenticated USING (true);
