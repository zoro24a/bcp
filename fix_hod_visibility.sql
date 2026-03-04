-- ==========================================
-- SQL Fix for HOD Visibility (RLS Policies)
-- ==========================================

-- 1. Ensure Profiles are readable by all authenticated users
-- This allows Tutors to resolve names of HODs and other staff.
DROP POLICY IF EXISTS "Profiles read access" ON public.profiles;
CREATE POLICY "Profiles read access" ON public.profiles 
FOR SELECT TO authenticated 
USING (true);

-- 2. Ensure Batches are readable by all authenticated users
-- Tutors need to see batch details to determine the student's department.
DROP POLICY IF EXISTS "Batches read access" ON public.batches;
CREATE POLICY "Batches read access" ON public.batches 
FOR SELECT TO authenticated 
USING (true);

-- 3. Ensure Departments are readable by all authenticated users
DROP POLICY IF EXISTS "Departments read access" ON public.departments;
CREATE POLICY "Departments read access" ON public.departments 
FOR SELECT TO authenticated 
USING (true);

-- 4. Ensure Students are readable by all authenticated users
-- This is often necessary for common lookups in the portal.
DROP POLICY IF EXISTS "Students read access" ON public.students;
CREATE POLICY "Students read access" ON public.students 
FOR SELECT TO authenticated 
USING (true);

-- 5. Verification Query (Run this to check if HODs are found for a student's dept)
/*
SELECT p.* 
FROM profiles p
JOIN batches b ON b.department_id = p.department_id
JOIN students s ON s.batch_id = b.id
WHERE s.id = 'YOUR_STUDENT_ID_HERE' 
AND p.role = 'hod';
*/
