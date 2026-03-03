-- ========================================================
-- ANTI-RECURSION FIX: Office RLS Visibility
-- ========================================================

-- 1. Create a SECURITY DEFINER function to fetch the user's role.
-- This bypasses RLS for the query inside the function, preventing recursion.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. CLEANUP: Remove old recursive or conflicting policies
DROP POLICY IF EXISTS "Office Select Policy" ON public.requests;
DROP POLICY IF EXISTS "Office Update Policy" ON public.requests;
DROP POLICY IF EXISTS "Office can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 3. PROFILES: Non-recursive policies
-- Always allow users to see their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (id = auth.uid());

-- Allow Office role to see all profiles (uses the non-recursive function)
CREATE POLICY "Office can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (get_auth_role() = 'office');


-- 4. REQUESTS: Update policies to use the non-recursive function
-- This ensures the requests list also doesn't trigger recursion via profile checks
CREATE POLICY "Office Select Policy" ON public.requests
FOR SELECT TO authenticated
USING (
  get_auth_role() = 'office'
  AND status IN ('Ready for Issue', 'Issued')
);

CREATE POLICY "Office Update Policy" ON public.requests
FOR UPDATE TO authenticated
USING (
  get_auth_role() = 'office'
  AND status = 'Ready for Issue'
)
WITH CHECK (
  status IN ('Issued', 'Returned by Office')
);

-- 5. VERIFICATION:
-- Run these to confirm the function and policies are working correctly.
/*
-- Check if function works for your current session
SELECT public.get_auth_role();

-- Check active policies
SELECT * FROM pg_policies WHERE tablename IN ('profiles', 'requests');
*/
