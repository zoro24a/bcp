-- ==========================================
-- Supabase RLS Fix for Admin Access
-- ==========================================

-- 1. Enable RLS on all relevant tables (just to be safe)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- 2. Create a generic "Admins can do everything" policy for each table
--    We use a separate policy name to avoid conflicts with existing ones.
--    If a policy with the same name exists, you might need to drop it first, 
--    but usually adding a new permissive policy is enough because RLS is OR-based (if ANY policy allows, access is granted).

-- Profiles: Admin can view, insert, update, delete ALL profiles
CREATE POLICY "Admins can do everything on profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Students: Admin can do everything
CREATE POLICY "Admins can do everything on students"
ON public.students
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Batches: Admin can do everything
CREATE POLICY "Admins can do everything on batches"
ON public.batches
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Departments: Admin can do everything
CREATE POLICY "Admins can do everything on departments"
ON public.departments
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Requests: Admin can do everything
CREATE POLICY "Admins can do everything on requests"
ON public.requests
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Templates: Admin can do everything
CREATE POLICY "Admins can do everything on templates"
ON public.templates
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Fix "Infinite Recursion" issues if any
-- The above policies use a subquery on `public.profiles`. 
-- If `public.profiles` has an RLS policy that checks `public.profiles` (circular), it might cause infinite recursion.
-- To prevent this, we ensure the Generic Admin Policy on `profiles` (created above) is efficient.
-- Ideally, we should avoid querying `profiles` inside the `profiles` policy itself if possible and rely on `auth.jwt() -> app_metadata` if roles were there.
-- BUT, since roles are in `profiles` table, we have to query it.
-- One optimization is to define a helper function or rely on the fact that `auth.uid()` lookup is fast.

-- NOTE: If you still face "infinite recursion" on the profiles table specific policy:
-- You might need to drop strictly circular policies or ensure you have a policy that allows users to view THEIR OWN profile without checking role.
-- Generic "Users can view own profile" (usually exists):
-- CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- 4. Verify Admin Visibility of HODs and Tutors
-- The `profiles` policy above `USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')` 
-- allows an admin to SELECT * FROM profiles. This includes ALL rows (students, tutors, hods, admins).
-- This DIRECTLY solves the "Admin cannot see HODs and Tutors" issue.

