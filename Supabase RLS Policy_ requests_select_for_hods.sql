CREATE POLICY "HODs can view requests for students in their department"
ON public.requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.batches b ON s.batch_id = b.id
    JOIN public.profiles p_hod ON b.department_id = p_hod.department_id
    WHERE
      s.id = requests.student_id AND
      p_hod.id = auth.uid() AND
      p_hod.role = 'hod' AND
      requests.status = 'Pending HOD Approval'
  )
);