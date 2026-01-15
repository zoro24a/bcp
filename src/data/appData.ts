import { supabase } from "@/integrations/supabase/client";
import {
  BonafideRequest,
  Profile,
  Department,
  Batch,
  CertificateTemplate,
  StudentDetails,
  TutorDetails,
  HodDetails,
  RequestStatus,
  AdminListUsersOptions,
} from "@/lib/types";
import { showError } from "@/utils/toast";

// This file will now contain functions to interact with Supabase.

export const fetchRequests = async (): Promise<BonafideRequest[]> => {
  const { data, error } = await supabase.from("requests").select("*");
  if (error) {
    console.error("Error fetching requests:", error);
    throw new Error("Failed to fetch requests: " + error.message);
  }
  return data as BonafideRequest[];
};

export const fetchProfiles = async (role?: string): Promise<Profile[]> => {
  let query = supabase.from("profiles").select("*");
  if (role) {
    query = query.eq("role", role);
  }
  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching ${role || ''} profiles:`, error);
    throw new Error(`Failed to fetch ${role || ''} profiles: ` + error.message);
  }
  return data as Profile[];
};

export const fetchStudentDetails = async (studentId: string): Promise<StudentDetails | null> => {
  console.log("Dyad Debug: Starting fetchStudentDetails for ID:", studentId);

  // 1. Fetch the base profile data for the student
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", studentId)
    .single();

  if (profileError || !profileData) {
    console.error("Dyad Debug: Error fetching student profile:", profileError);
    // If no profile is found, we can't proceed. Return null as per function signature.
    if (profileError?.code === 'PGRST116') {
        console.error(`Dyad Debug: No profile found for student ID: ${studentId}`);
        return null;
    }
    throw new Error("Failed to fetch student profile: " + profileError?.message);
  }
  console.log("Dyad Debug: Fetched profileData:", profileData);

  // 2. Fetch the student-specific details using maybeSingle()
  const { data: studentSpecificData, error: studentSpecificError } = await supabase
    .from("students")
    .select(`
      register_number,
      parent_name,
      batch_id,
      tutor_id,
      hod_id
    `)
    .eq("id", studentId)
    .maybeSingle();

  if (studentSpecificError) {
    console.error("Dyad Debug: Error fetching student-specific data:", studentSpecificError);
    throw new Error("Failed to fetch student-specific data: " + studentSpecificError.message);
  }

  // Initialize student details with defaults if studentSpecificData is null
  const studentDetailsBase = {
    register_number: studentSpecificData?.register_number || 'N/A',
    parent_name: studentSpecificData?.parent_name,
    batch_id: studentSpecificData?.batch_id,
    tutor_id: studentSpecificData?.tutor_id,
    hod_id: studentSpecificData?.hod_id,
  };

  const { batch_id, tutor_id, hod_id } = studentDetailsBase;

  let batch: Batch | null = null;
  let department: Department | null = null;
  let tutor: Profile | null = null;
  let hod: Profile | null = null;

  // 3. Fetch Batch details
  if (batch_id) {
    const { data: batchData, error: batchError } = await supabase
      .from("batches")
      .select(`*`)
      .eq("id", batch_id)
      .maybeSingle(); // Use maybeSingle for robustness
      
    if (batchError) {
      console.warn("Dyad Debug: Error fetching batch details:", batchError);
    } else {
      batch = batchData as Batch || null;
      console.log("Dyad Debug: Fetched batchData:", batch);

      // 3b. Fetch Department details separately
      if (batch?.department_id) {
        const { data: departmentData, error: departmentError } = await supabase
          .from("departments")
          .select(`name`)
          .eq("id", batch.department_id)
          .maybeSingle();
        
        if (departmentError) {
          console.warn("Dyad Debug: Error fetching department details:", departmentError);
        } else {
          department = departmentData as Department || null;
          console.log("Dyad Debug: Fetched departmentData:", department);
        }
      }
    }
  } else {
    console.log("Dyad Debug: No batch_id found for student.");
  }

  // 4. Fetch Tutor profile
  if (tutor_id) {
    const { data: tutorData, error: tutorError } = await supabase
      .from("profiles")
      .select(`id, first_name, last_name`)
      .eq("id", tutor_id)
      .maybeSingle();
    if (tutorError) {
      console.warn("Dyad Debug: Error fetching tutor profile:", tutorError);
    } else {
      tutor = tutorData as Profile || null;
      console.log("Dyad Debug: Fetched tutorData:", tutor);
    }
  } else {
    console.log("Dyad Debug: No tutor_id found for student.");
  }

  // 5. Fetch HOD profile
  if (hod_id) {
    const { data: hodData, error: hodError } = await supabase
      .from("profiles")
      .select(`id, first_name, last_name`)
      .eq("id", hod_id)
      .maybeSingle();
    if (hodError) {
      console.warn("Dyad Debug: Error fetching HOD profile:", hodError);
    } else {
      hod = hodData as Profile || null;
      console.log("Dyad Debug: Fetched hodData:", hod);
    }
  } else {
    console.log("Dyad Debug: No hod_id found for student.");
  }

  return {
    ...profileData,
    ...studentDetailsBase, // Includes register_number, parent_name, etc.
    batch_id: batch?.id,
    batch_name: batch ? `${batch.name} ${batch.section || ''}`.trim() : undefined,
    current_semester: batch?.current_semester,
    department_id: department?.id || batch?.department_id,
    department_name: department?.name,
    tutor_id: tutor?.id,
    tutor_name: tutor ? `${tutor.first_name} ${tutor.last_name || ''}`.trim() : undefined,
    hod_id: hod?.id,
    hod_name: hod ? `${hod.first_name} ${hod.last_name || ''}`.trim() : undefined,
  } as StudentDetails;
};

export const fetchAllStudentsWithDetails = async (): Promise<StudentDetails[]> => {
  // Fetch all student-specific data
  const { data: studentsData, error: studentsError } = await supabase
    .from("students")
    .select(`
      id,
      register_number,
      parent_name,
      batch_id,
      tutor_id,
      hod_id
    `);

  if (studentsError) {
    console.error("Error fetching all students data:", studentsError);
    throw new Error("Failed to fetch all students data: " + studentsError.message);
  }

  // Fetch all profiles (for students, tutors, HODs)
  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select(`id, first_name, last_name, username, email, phone_number, avatar_url, role, department_id`);

  if (profilesError) {
    console.error("Error fetching all profiles:", profilesError);
    throw new Error("Failed to fetch all profiles: " + profilesError.message);
  }

  // Fetch all batches with department names (Removed embedded join here too for safety)
  const { data: batchesData, error: batchesError } = await supabase
    .from("batches")
    .select(`id, name, section, current_semester, department_id`); // Removed departments(name)

  if (batchesError) {
    console.error("Error fetching all batches:", batchesError);
    throw new Error("Failed to fetch all batches: " + batchesError.message);
  }
  
  // Fetch all departments separately
  const { data: departmentsData, error: departmentsError } = await supabase
    .from("departments")
    .select(`id, name`);

  if (departmentsError) {
    console.error("Error fetching all departments:", departmentsError);
    throw new Error("Failed to fetch all departments: " + departmentsError.message);
  }

  const profilesMap = new Map(profilesData.map(p => [p.id, p]));
  const batchesMap = new Map(batchesData.map(b => [b.id, b]));
  const departmentsMap = new Map(departmentsData.map(d => [d.id, d]));

  return studentsData.map((student: any) => {
    const studentProfile = profilesMap.get(student.id);
    const batch = batchesMap.get(student.batch_id);
    const department = departmentsMap.get(batch?.department_id);
    const tutorProfile = profilesMap.get(student.tutor_id);
    const hodProfile = profilesMap.get(student.hod_id);

    return {
      id: student.id,
      register_number: student.register_number,
      parent_name: student.parent_name,
      first_name: studentProfile?.first_name,
      last_name: studentProfile?.last_name,
      username: studentProfile?.username,
      email: studentProfile?.email,
      phone_number: studentProfile?.phone_number,
      avatar_url: studentProfile?.avatar_url,
      role: studentProfile?.role,
      batch_id: batch?.id,
      batch_name: batch ? `${batch.name} ${batch.section || ''}`.trim() : undefined,
      current_semester: batch?.current_semester,
      department_id: department?.id,
      department_name: department?.name,
      tutor_id: tutorProfile?.id,
      tutor_name: tutorProfile ? `${tutorProfile.first_name} ${tutorProfile.last_name || ''}`.trim() : undefined,
      hod_id: hodProfile?.id,
      hod_name: hodProfile ? `${hodProfile.first_name} ${hodProfile.last_name || ''}`.trim() : undefined,
    } as StudentDetails;
  });
};


export const fetchTutorDetails = async (tutorId: string): Promise<TutorDetails | null> => {
  // 1. Fetch the base profile data for the tutor
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(`
      *
    `)
    .eq("id", tutorId)
    .single();

  if (profileError || !profileData) {
    console.error("Error fetching tutor profile:", profileError);
    throw new Error("Failed to fetch tutor profile: " + profileError?.message);
  }
  
  let department: Department | null = null;
  if (profileData.department_id) {
    const { data: departmentData, error: departmentError } = await supabase
      .from("departments")
      .select(`name`)
      .eq("id", profileData.department_id)
      .maybeSingle();
    if (departmentError) {
      console.warn("Error fetching department name for tutor:", departmentError);
    } else {
      department = departmentData as Department || null;
    }
  }

  // 2. Separately fetch the batch(es) assigned to this tutor
  const { data: assignedBatches, error: batchesError } = await supabase
    .from("batches")
    .select(`name, section`);

  if (batchesError) {
    console.warn("Error fetching assigned batches for tutor:", batchesError);
  }

  // Combine batch names into a single string if multiple, or just the first one
  const batchAssignedName = assignedBatches && assignedBatches.length > 0
    ? assignedBatches.map(b => `${b.name} ${b.section || ''}`.trim()).join(', ')
    : undefined;

  return {
    ...profileData,
    department_name: department?.name,
    batch_assigned_name: batchAssignedName,
  } as TutorDetails;
};

export const fetchHodDetails = async (hodId: string): Promise<HodDetails | null> => {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(`
      *
    `)
    .eq("id", hodId)
    .single();

  if (profileError || !profileData) {
    console.error("Error fetching HOD profile:", profileError);
    throw new Error("Failed to fetch HOD profile: " + profileError?.message);
  }

  let department: Department | null = null;
  if (profileData.department_id) {
    const { data: departmentData, error: departmentError } = await supabase
      .from("departments")
      .select(`name`)
      .eq("id", profileData.department_id)
      .maybeSingle();
    if (departmentError) {
      console.warn("Error fetching department name for HOD:", departmentError);
    } else {
      department = departmentData as Department || null;
    }
  }

  return {
    ...profileData,
    department_name: department?.name,
  } as HodDetails;
};


export const fetchDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabase.from("departments").select("*");
  if (error) {
    console.error("Error fetching departments:", error);
    throw new Error("Failed to fetch departments: " + error.message);
  }
  return data as Department[];
};

export const fetchBatches = async (): Promise<Batch[]> => {
  const { data, error } = await supabase.from("batches").select(`
    *,
    tutors:profiles!batches_tutor_id_fkey(first_name, last_name)
  `);
  if (error) {
    console.error("Error fetching batches:", error);
    throw new Error("Failed to fetch batches: " + error.message);
  }
  return data as Batch[];
};

export const fetchTemplates = async (): Promise<CertificateTemplate[]> => {
  const { data, error } = await supabase.from("templates").select("*");
  if (error) {
    console.error("Error fetching templates:", error);
    throw new Error("Failed to fetch templates: " + error.message);
  }
  return data as CertificateTemplate[];
};

// Example functions for data manipulation
export const createRequest = async (newRequest: Omit<BonafideRequest, 'id' | 'created_at'>): Promise<BonafideRequest | null> => {
  const { data, error } = await supabase.from("requests").insert(newRequest).select().single();
  if (error) {
    console.error("Error creating request:", error);
    return null;
  }
  return data as BonafideRequest;
};

export const updateRequestStatus = async (requestId: string, status: RequestStatus, returnReason?: string, templateId?: string): Promise<BonafideRequest | null> => {
  const updateData: Partial<BonafideRequest> = { status };
  if (returnReason) {
    updateData.return_reason = returnReason;
  }
  if (templateId) {
    updateData.template_id = templateId;
  }
  // MODIFIED: Removed .single() to avoid PGRST116 error when RLS prevents reading the updated row back.
  const { data, error } = await supabase.from("requests").update(updateData).eq("id", requestId).select();
  if (error) {
    console.error("Error updating request status:", error);
    return null;
  }
  // Return the first element if data is an array, or null if empty
  return data?.[0] as BonafideRequest || null;
};

export const updateProfile = async (userId: string, updates: Partial<Profile>): Promise<Profile | null> => {
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", userId).select().single();
  if (error) {
    console.error("Error updating profile:", error);
    return null;
  }
  return data as Profile;
};

export const createDepartment = async (newDepartment: Omit<Department, 'id' | 'created_at'>): Promise<Department | null> => {
  const { data, error } = await supabase.from("departments").insert(newDepartment).select().single();
  if (error) {
    console.error("Error creating department:", error);
    return null;
  }
  return data as Department;
};

export const createBatch = async (newBatch: Omit<Batch, 'id' | 'created_at'>): Promise<Batch | null> => {
  const { data, error } = await supabase.from("batches").insert(newBatch).select().single();
  if (error) {
    console.error("Error creating batch:", error);
    return null;
  }
  return data as Batch;
};

export const updateBatch = async (batchId: string, updates: Partial<Batch>): Promise<Batch | null> => {
  const { data, error } = await supabase.from("batches").update(updates).eq("id", batchId).select().single();
  if (error) {
    console.error("Error updating batch:", error);
    return null;
  }
  return data as Batch;
};

export const createTemplate = async (
  newTemplate: Omit<CertificateTemplate, 'id' | 'created_at' | 'file_url'> // Removed file parameter
): Promise<CertificateTemplate | null> => {
  // Template type is now always 'html', and content is directly stored.
  // No file upload logic needed.
  const { data, error } = await supabase.from("templates").insert({
    ...newTemplate,
    template_type: "html", // Ensure it's always HTML
    file_url: null, // Explicitly set file_url to null for HTML templates
  }).select().single();

  if (error) {
    console.error("Error creating template in DB:", error);
    showError("Failed to create template in database: " + error.message);
    return null;
  }
  return data as CertificateTemplate;
};

export const updateTemplate = async (
  templateId: string,
  updates: Partial<Omit<CertificateTemplate, 'created_at' | 'file_url'>> // Removed file parameter
): Promise<CertificateTemplate | null> => {
  // No file upload/deletion logic needed.
  // Ensure template_type is always 'html' and file_url is null.
  const updatePayload: Partial<CertificateTemplate> = {
    ...updates,
    template_type: "html", // Ensure it's always HTML
    file_url: null, // Explicitly set file_url to null for HTML templates
  };

  const { data, error } = await supabase.from("templates").update(updatePayload).eq("id", templateId).select().single();
  if (error) {
    console.error("Error updating template in DB:", error);
    showError("Failed to update template in database: " + error.message);
    return null;
  }
  return data as CertificateTemplate;
};

export const deleteTemplate = async (templateId: string): Promise<boolean> => {
  // No file deletion from storage needed as templates are now HTML content only.
  const { error } = await supabase.from("templates").delete().eq("id", templateId);
  if (error) {
    console.error("Error deleting template from DB:", error);
    showError("Failed to delete template from database: " + error.message);
    return false;
  }
  return true;
};

// Utility function to remove undefined properties from an object
const cleanObject = <T extends object>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
};

// Define a specific type for the studentData parameter in createStudent
interface NewStudentDetailsPayload {
  register_number: string;
  parent_name?: string;
  batch_id?: string;
  tutor_id?: string; // Now optional
  hod_id?: string; // Now optional
}

// Define the return type for createStudent to handle success or specific errors
type CreateStudentResult = StudentDetails | { error: string };

export const createStudent = async (
  profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>,
  studentData: NewStudentDetailsPayload,
  password?: string // Make password optional
): Promise<CreateStudentResult | null> => {
  const { email, username, ...otherProfileData } = profileData;
  
  // Generate a random password if not provided (e.g., for bulk upload)
  const finalPassword = password || Math.random().toString(36).slice(-8); // Simple random password

  // CRITICAL CHECK: Ensure email and password are valid before invoking Edge Function
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return { error: "Email is missing or invalid for user creation." };
  }
  if (!finalPassword || finalPassword.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }

  // Clean metadata before sending to Edge Function
  const cleanedMetaData = cleanObject({
    ...otherProfileData,
    username: username || `${otherProfileData.first_name}.${studentData.register_number}`,
    role: 'student',
  });

  // 1. Create the user in Supabase Auth via Edge Function (This will fail if the user already exists)
  const { data: authData, error: authError } = await supabase.functions.invoke('manage-users', {
    body: JSON.stringify({
      action: 'signUp',
      payload: {
        credentials: {
          email: email,
          password: finalPassword,
          options: {
            data: cleanedMetaData,
          },
        },
      },
    }),
  });

  if (authError) {
    console.error("Error signing up student user via Edge Function:", authError);
    // Check for specific error messages related to duplicate email
    if (authError.message.includes('User already exists') || authError.message.includes('duplicate key value')) {
      return { error: `A user with email "${email}" already exists.` };
    }
    // Log the full error response if available
    const responseBody = (authError as any).context?.body;
    if (responseBody) {
        console.error("Edge Function Response Body:", responseBody);
        try {
            const parsedBody = JSON.parse(responseBody);
            if (parsedBody.error) {
                return { error: "Failed to create student user: " + parsedBody.error };
            }
        } catch (e) {
            // Ignore parsing error
        }
    }
    return { error: "Failed to create student user: " + authError.message };
  }

  const newUser = (authData as any)?.user; // Cast to any to access user property
  if (newUser) {
    // The trigger `handle_new_user` should have created the profile.
    // We need to fetch it to get the complete Profile object and ensure it exists.
    const { data: newProfile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", newUser.id)
      .single();

    if (profileFetchError || !newProfile) {
      console.error("Error fetching newly created student profile:", profileFetchError);
      // Rollback: delete the auth user if profile creation failed
      await supabase.functions.invoke('manage-users', {
        body: JSON.stringify({
          action: 'deleteUser',
          payload: { userId: newUser.id },
        }),
      });
      return { error: "Failed to retrieve new student profile after creation." };
    }

    // 2. Insert student-specific details into the 'students' table
    // Ensure we only insert non-undefined values
    const studentInsertPayload = cleanObject({
      id: newProfile.id, // Link to the newly created profile/auth user ID
      register_number: studentData.register_number,
      parent_name: studentData.parent_name,
      batch_id: studentData.batch_id,
      tutor_id: studentData.tutor_id,
      hod_id: studentData.hod_id,
    });

    const { data: newStudentSpecificData, error: studentError } = await supabase
      .from("students")
      .insert(studentInsertPayload)
      .select()
      .single();

    if (studentError || !newStudentSpecificData) {
      console.error("Error creating student entry:", studentError);
      
      // Check for duplicate register number error (code '23505' for unique constraint violation)
      if (studentError?.code === '23505' && studentError.message.includes('students_register_number_key')) {
        const errorMessage = `Register number "${studentData.register_number}" already exists.`;
        
        // Roll back: delete the profile and auth user if student-specific data creation fails
        await supabase.from("profiles").delete().eq("id", newProfile.id);
        await supabase.functions.invoke('manage-users', {
          body: JSON.stringify({
            action: 'deleteUser',
            payload: { userId: newProfile.id },
          }),
        });
        return { error: errorMessage };
      }
      
      // Roll back for other errors
      await supabase.from("profiles").delete().eq("id", newProfile.id);
      await supabase.functions.invoke('manage-users', {
        body: JSON.stringify({
          action: 'deleteUser',
          payload: { userId: newProfile.id },
        }),
      });
      return { error: "Failed to create student entry: " + studentError?.message };
    }

    return { ...newProfile, ...newStudentSpecificData } as StudentDetails;
  }
  return null;
};

export const createTutor = async (profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>, password: string): Promise<Profile | null> => {
  const { email, ...metaData } = profileData;
  
  const cleanedMetaData = cleanObject(metaData);

  // 1. Create the user in Supabase Auth via Edge Function (This will fail if the user already exists)
  const { data: authData, error: authError } = await supabase.functions.invoke('manage-users', {
    body: JSON.stringify({
      action: 'signUp',
      payload: {
        credentials: {
          email: email!,
          password: password,
          options: {
            data: cleanedMetaData,
          },
        },
      },
    }),
  });

  if (authError) {
    console.error("Error signing up tutor user via Edge Function:", authError);
    const responseBody = (authError as any).context?.body;
    if (responseBody) {
        try {
            const parsedBody = JSON.parse(responseBody);
            showError("Failed to create tutor user: " + (parsedBody.error || authError.message));
        } catch (e) {
            showError("Failed to create tutor user: " + authError.message);
        }
    } else {
        showError("Failed to create tutor user: " + authError.message);
    }
    return null;
  }

  const newUser = (authData as any)?.user;
  if (newUser) {
    // The trigger `handle_new_user` should have created the profile.
    // We need to fetch it to return the complete Profile object.
    const { data: newProfile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", newUser.id)
      .single();

    if (profileFetchError || !newProfile) {
      console.error("Error fetching newly created tutor profile:", profileFetchError);
      showError("Failed to retrieve new tutor profile: " + profileFetchError?.message);
      // Optionally, attempt to delete the auth user if profile creation failed
      await supabase.functions.invoke('manage-users', {
        body: JSON.stringify({
          action: 'deleteUser',
          payload: { userId: newUser.id },
        }),
      });
      return null;
    }
    return newProfile as Profile;
  }
  return null;
};

export const updateTutor = async (tutorId: string, updates: Partial<Profile>): Promise<Profile | null> => {
  // Note: This function only updates the 'profiles' table.
  // Password updates are handled by updateUserPassword.
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", tutorId).select().single();
  if (error) {
    console.error("Error updating tutor profile:", error);
    return null;
  }
  return data as Profile;
};

export const updateUserPassword = async (userId: string, newPassword: string): Promise<boolean> => {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: JSON.stringify({
      action: 'updateUserById',
      payload: {
        userId: userId,
        updates: { password: newPassword },
      },
    }),
  });

  if (error) {
    console.error("Error updating user password via Edge Function:", error);
    const responseBody = (error as any).context?.body;
    if (responseBody) {
        try {
            const parsedBody = JSON.parse(responseBody);
            showError("Failed to update user password: " + (parsedBody.error || error.message));
        } catch (e) {
            showError("Failed to update user password: " + error.message);
        }
    } else {
        showError("Failed to update user password: " + error.message);
    }
    return false;
  }
  console.log("User password updated successfully for user:", (data as any)?.user?.id);
  return true;
};

export const deleteTutor = async (tutorId: string): Promise<boolean> => {
  // When deleting a tutor, we should also delete their auth.users entry via Edge Function.
  const { error } = await supabase.functions.invoke('manage-users', {
    body: JSON.stringify({
      action: 'deleteUser',
      payload: { userId: tutorId },
    }),
  });

  if (error) {
    console.error("Error deleting tutor user via Edge Function:", error);
    return false;
  }
  return true;
};

export const createHod = async (profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>, password: string): Promise<Profile | null> => {
  const { email, ...metaData } = profileData;
  
  const cleanedMetaData = cleanObject(metaData);

  // 1. Create the user in Supabase Auth via Edge Function (This will fail if the user already exists)
  const { data: authData, error: authError } = await supabase.functions.invoke('manage-users', {
    body: JSON.stringify({
      action: 'signUp',
      payload: {
        credentials: {
          email: email!,
          password: password,
          options: {
            data: cleanedMetaData,
          },
        },
      },
    }),
  });

  if (authError) {
    console.error("Error signing up HOD user via Edge Function:", authError);
    const responseBody = (authError as any).context?.body;
    if (responseBody) {
        try {
            const parsedBody = JSON.parse(responseBody);
            showError("Failed to create HOD user: " + (parsedBody.error || authError.message));
        } catch (e) {
            showError("Failed to create HOD user: " + authError.message);
        }
    } else {
        showError("Failed to create HOD user: " + authError.message);
    }
    return null;
  }

  const newUser = (authData as any)?.user;
  if (newUser) {
    // The trigger `handle_new_user` should have created the profile.
    // We need to fetch it to return the complete Profile object.
    const { data: newProfile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", newUser.id)
      .single();

    if (profileFetchError || !newProfile) {
      console.error("Error fetching newly created HOD profile:", profileFetchError);
      showError("Failed to retrieve new HOD profile: " + profileFetchError?.message);
      // Optionally, attempt to delete the auth user if profile creation failed
      await supabase.functions.invoke('manage-users', {
        body: JSON.stringify({
          action: 'deleteUser',
          payload: { userId: newUser.id },
        }),
      });
      return null;
    }
    return newProfile as Profile;
  }
  return null;
};

export const updateHod = async (hodId: string, updates: Partial<Profile>): Promise<Profile | null> => {
  const { data, error } = await supabase.from("profiles").update(updates).eq("id", hodId).select().single();
  if (error) {
    console.error("Error updating HOD:", error);
    return null;
  }
  return data as Profile;
};

export const deleteHod = async (hodId: string): Promise<boolean> => {
  // When deleting a HOD, we should also delete their auth.users entry via Edge Function.
  const { error } = await supabase.functions.invoke('manage-users', {
    body: JSON.stringify({
      action: 'deleteUser',
      payload: { userId: hodId },
    }),
  });

  if (error) {
    console.error("Error deleting HOD user via Edge Function:", error);
    return false;
  }
  return true;
};