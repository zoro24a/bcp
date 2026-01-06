SELECT
  r.*
FROM
  public.requests r
WHERE
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.batches b ON s.batch_id = b.id
    JOIN public.profiles p_hod ON b.department_id = p_hod.department_id
    WHERE
      s.id = r.student_id AND
      p_hod.id = 'YOUR_HOD_UUID' AND -- Replace with the actual HOD's UUID
      p_hod.role = 'hod' AND
      r.status = 'Pending HOD Approval'
  );