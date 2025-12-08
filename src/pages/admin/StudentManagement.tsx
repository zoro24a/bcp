import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  fetchAllStudentsWithDetails,
  fetchBatches,
  fetchDepartments,
  createStudent,
  fetchProfiles,
  createBatch,
} from "@/data/appData";
import { Download, MoreHorizontal, Upload, UserPlus, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadStudentTemplate, parseStudentFile } from "@/lib/xlsx";
import { showSuccess, showError } from "@/utils/toast";
import { StudentDetails, Department, Batch, Profile } from "@/lib/types";
import { calculateCurrentSemesterForBatch, getSemesterDateRange } from "@/lib/utils";
import BulkUploadWorkflow from "@/components/admin/BulkUploadWorkflow";

const StudentManagement = () => {
  const [allStudents, setAllStudents] = useState<StudentDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tutors, setTutors] = useState<Profile[]>([]);
  const [hods, setHods] = useState<Profile[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isAddSingleStudentDialogOpen, setIsAddSingleStudentDialogOpen] = useState(false);
  const [newStudentData, setNewStudentData] = useState<Partial<StudentDetails>>({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
    register_number: "",
    parent_name: "",
    department_id: "",
    batch_id: "",
    tutor_id: undefined,
    hod_id: undefined,
  });
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedStartYear, setSelectedStartYear] = useState("");
  const [selectedEndYear, setSelectedEndYear] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);
  const sections = ["A", "B", "C", "D", "No Section"];

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const fetchedStudents = await fetchAllStudentsWithDetails();
      const fetchedDepartments = await fetchDepartments();
      const fetchedBatches = await fetchBatches();
      const fetchedTutors = await fetchProfiles('tutor');
      const fetchedHods = await fetchProfiles('hod');

      setAllStudents(fetchedStudents);
      setDepartments(fetchedDepartments);
      setBatches(fetchedBatches);
      setTutors(fetchedTutors);
      setHods(fetchedHods);
    } catch (error: any) {
      showError(error.message);
      setAllStudents([]);
      setDepartments([]);
      setBatches([]);
      setTutors([]);
      setHods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const filteredStudents = useMemo(() => {
    return allStudents.filter((student) => {
      const departmentMatch =
        selectedDepartment === "all" || student.department_name === selectedDepartment;
      const batchMatch =
        selectedBatch === "all" || student.batch_name === selectedBatch;
      return departmentMatch && batchMatch;
    });
  }, [allStudents, selectedDepartment, selectedBatch]);

  // Helper function to parse batch name string into components
  const parseBatchName = (batchName: string): { startYear: string, endYear: string, section: string | null } => {
    const parts = batchName.trim().split(' ');
    const yearRange = parts[0];
    const section = parts.length > 1 ? parts.slice(1).join(' ') : null;
    const yearParts = yearRange.split('-');
    
    return {
      startYear: yearParts[0] || '',
      endYear: yearParts[1] || '',
      section: section || null,
    };
  };

  // Helper function to find or create a batch
  const findOrCreateBatch = async (departmentId: string, batchName: string, existingBatches: Batch[]): Promise<{ batch: Batch | null, error?: string }> => {
    const { startYear, endYear, section } = parseBatchName(batchName);
    
    if (!startYear || !endYear) {
      return { batch: null, error: `Invalid batch name format: ${batchName}` };
    }

    const fullBatchName = `${startYear}-${endYear}${section ? ' ' + section : ''}`.trim();

    // 1. Try to find existing batch
    const existingBatch = existingBatches.find(
      (b) =>
        b.department_id === departmentId &&
        b.name === `${startYear}-${endYear}` &&
        (b.section === section || (!b.section && !section))
    );

    if (existingBatch) {
      return { batch: existingBatch };
    }

    // 2. If not found, create it
    const currentSemester = calculateCurrentSemesterForBatch(fullBatchName);
    const { from, to } = getSemesterDateRange(fullBatchName, currentSemester);

    const newBatchPayload: Omit<Batch, 'id' | 'created_at'> = {
      name: `${startYear}-${endYear}`,
      section: section,
      tutor_id: null, // Unassigned by default in bulk creation
      total_sections: 1, // Default to 1 section
      student_count: 0,
      status: "Active",
      current_semester: currentSemester,
      semester_from_date: from,
      semester_to_date: to,
      department_id: departmentId,
    };

    const createdBatch = await createBatch(newBatchPayload);

    if (!createdBatch) {
      return { batch: null, error: `Failed to automatically create batch: ${fullBatchName}` };
    }
    
    // Update local state with the new batch (important for subsequent students in the same file)
    setBatches(prev => [...prev, createdBatch]);
    return { batch: createdBatch };
  };

  // Find the matching batch based on year range and section (for single add form)
  const findMatchingBatch = () => {
    if (!newStudentData.department_id || !selectedStartYear || !selectedEndYear) {
      return null;
    }
    
    const batchName = `${selectedStartYear}-${selectedEndYear}`;
    const sectionToMatch = selectedSection === "No Section" ? null : selectedSection;
    
    return batches.find(
      (b) =>
        b.department_id === newStudentData.department_id &&
        b.name === batchName &&
        b.section === sectionToMatch
    ) || null;
  };

  const filteredTutorsByDepartment = useMemo(() => {
    return tutors.filter(tutor => tutor.department_id === newStudentData.department_id);
  }, [tutors, newStudentData.department_id]);

  const filteredHodsByDepartment = useMemo(() => {
    return hods.filter(hod => hod.department_id === newStudentData.department_id);
  }, [hods, newStudentData.department_id]);

  // Helper to find profile ID by full name (first_name + last_name)
  const findProfileIdByName = (fullName: string, profiles: Profile[]): string | undefined => {
    if (!fullName) return undefined;
    const normalizedName = fullName.toLowerCase().replace(/\s+/g, ' ').trim();
    
    return profiles.find(p => {
      const profileFullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
      return profileFullName === normalizedName;
    })?.id;
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      showError("Please select a file to upload.");
      return;
    }

    try {
      const parsedStudents = await parseStudentFile(uploadFile);
      const newStudents: StudentDetails[] = [];
      const errors: string[] = [];

      // Pre-fetch all profiles for lookup
      const allTutors = await fetchProfiles('tutor');
      const allHods = await fetchProfiles('hod');

      for (const student of parsedStudents) {
        const studentIdentifier = `${student.first_name || 'N/A'} ${student.last_name || ''} (Reg: ${student.register_number || 'N/A'})`;

        // 1. Check for missing required fields
        const requiredFields = [
          { key: 'email', label: 'email' },
          { key: 'register_number', label: 'register_number' },
          { key: 'department_name', label: 'department_name' },
          { key: 'batch_name', label: 'batch_name' },
          { key: 'password', label: 'password' },
        ];
        
        const missingFields: string[] = [];
        requiredFields.forEach(({ key, label }) => {
          const value = (student as any)[key];
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            missingFields.push(label);
          }
        });

        if (missingFields.length > 0) {
          errors.push(`[Missing Data] ${studentIdentifier}: Missing fields: ${missingFields.join(', ')}.`);
          continue;
        }

        // 2. Check Department existence
        const department = departments.find(d => d.name === student.department_name);
        if (!department) {
          errors.push(`[Department Error] ${studentIdentifier}: Department "${student.department_name}" not found.`);
          continue;
        }

        // 3. Find or Create Batch
        const { batch, error: batchCreationError } = await findOrCreateBatch(department.id, student.batch_name!, batches);

        if (batchCreationError) {
          errors.push(`[Batch Error] ${studentIdentifier}: ${batchCreationError}`);
          continue;
        }
        
        if (!batch) {
          errors.push(`[Batch Error] ${studentIdentifier}: Batch "${student.batch_name}" could not be found or created.`);
          continue;
        }

        // 4. Resolve Tutor and HOD IDs
        let tutorId: string | undefined = batch.tutor_id || undefined; // Default to batch tutor
        let hodId: string | undefined = hods.find(h => h.department_id === department.id)?.id; // Default to department HOD

        if (student.tutor_name) {
          const resolvedTutorId = findProfileIdByName(student.tutor_name, allTutors);
          if (resolvedTutorId) {
            tutorId = resolvedTutorId;
          } else {
            errors.push(`[Tutor Error] ${studentIdentifier}: Tutor "${student.tutor_name}" not found. Using default/unassigned.`);
          }
        }

        if (student.hod_name) {
          const resolvedHodId = findProfileIdByName(student.hod_name, allHods);
          if (resolvedHodId) {
            hodId = resolvedHodId;
          } else {
            errors.push(`[HOD Error] ${studentIdentifier}: HOD "${student.hod_name}" not found. Using default/department HOD.`);
          }
        }

        // 5. Attempt Creation
        const result = await createStudent(
          {
            first_name: student.first_name,
            last_name: student.last_name,
            username: student.username || `${student.first_name}.${student.register_number}`,
            email: student.email,
            phone_number: student.phone_number,
            department_id: department.id,
            batch_id: batch.id,
            role: 'student',
          },
          {
            register_number: student.register_number,
            parent_name: student.parent_name,
            batch_id: batch.id,
            tutor_id: tutorId,
            hod_id: hodId,
          },
          student.password
        );

        if (result && 'error' in result) {
          errors.push(`[Creation Failed] ${studentIdentifier}: ${result.error}`);
        } else if (result) {
          newStudents.push(result);
        } else {
          errors.push(`[Unknown Error] ${studentIdentifier}: Failed to create student.`);
        }
      }

      if (newStudents.length > 0) {
        showSuccess(`${newStudents.length} students uploaded successfully!`);
      }
      if (errors.length > 0) {
        showError(`Bulk upload completed with ${errors.length} errors. Check console for details.`);
        console.error("Bulk Upload Errors:", errors);
      }
      
      setUploadFile(null);
      setIsUploadDialogOpen(false);
      fetchAllData();
    } catch (error: any) {
      showError("Failed to parse or upload file: " + error.message);
      console.error(error);
    }
  };

  const handleAddSingleStudent = async () => {
    if (!newStudentData.first_name || !newStudentData.email || !newStudentData.register_number || 
        !newStudentData.department_id || !selectedStartYear || !selectedEndYear || !selectedSection || !newStudentPassword) {
      showError("Please fill in all required fields.");
      return;
    }

    let matchingBatch = findMatchingBatch();
    let batchIdToUse: string;

    if (!matchingBatch) {
      // Batch does not exist, create it automatically
      const batchName = `${selectedStartYear}-${selectedEndYear}`;
      const sectionName = selectedSection === "No Section" ? null : selectedSection;
      const fullBatchName = sectionName ? `${batchName} ${sectionName}` : batchName;
      
      // Calculate semester details for the new batch
      const currentSemester = calculateCurrentSemesterForBatch(fullBatchName);
      const { from, to } = getSemesterDateRange(fullBatchName, currentSemester);

      const newBatchPayload: Omit<Batch, 'id' | 'created_at'> = {
        name: batchName,
        section: sectionName,
        tutor_id: newStudentData.tutor_id === "unassigned" ? undefined : newStudentData.tutor_id,
        total_sections: 1, // Default to 1 section if created manually here
        student_count: 1, // Starting count
        status: "Active",
        current_semester: currentSemester,
        semester_from_date: from,
        semester_to_date: to,
        department_id: newStudentData.department_id,
      };

      const createdBatch = await createBatch(newBatchPayload);

      if (!createdBatch) {
        showError("Failed to automatically create the required batch. Please check Batch Management.");
        return;
      }
      batchIdToUse = createdBatch.id;
      
      // Refresh all data to include the new batch in state for future use
      await fetchAllData(); 
    } else {
      // Batch exists, use its ID
      batchIdToUse = matchingBatch.id;
    }

    const result = await createStudent(
      {
        first_name: newStudentData.first_name,
        last_name: newStudentData.last_name,
        username: newStudentData.username || `${newStudentData.first_name}.${newStudentData.register_number}`,
        email: newStudentData.email,
        phone_number: newStudentData.phone_number,
        department_id: newStudentData.department_id,
        batch_id: batchIdToUse,
        role: 'student',
      },
      {
        register_number: newStudentData.register_number,
        parent_name: newStudentData.parent_name,
        batch_id: batchIdToUse,
        tutor_id: newStudentData.tutor_id === "unassigned" ? undefined : newStudentData.tutor_id,
        hod_id: newStudentData.hod_id === "unassigned" ? undefined : newStudentData.hod_id,
      },
      newStudentPassword
    );

    if (result && 'error' in result) {
      showError(result.error); // Display specific error from createStudent
    } else if (result) {
      showSuccess(`Student ${result.first_name} added successfully!`);
      setIsAddSingleStudentDialogOpen(false);
      fetchAllData(); // Refresh student list
    } else {
      showError("Failed to add single student due to an unknown error.");
    }
  };

  const handleAddStudentDialogOpenChange = (isOpen: boolean) => {
    setIsAddSingleStudentDialogOpen(isOpen);
    if (!isOpen) {
      setNewStudentData({
        first_name: "", last_name: "", username: "", email: "", phone_number: "",
        register_number: "", parent_name: "", department_id: "", batch_id: "",
        tutor_id: undefined, hod_id: undefined,
      });
      setNewStudentPassword("");
      setSelectedStartYear("");
      setSelectedEndYear("");
      setSelectedSection("");
      setShowPassword(false);
    }
  };

  const isAddStudentButtonDisabled = useMemo(() => {
    // Check if all required fields for the student and batch identification are filled
    return !newStudentData.first_name || !newStudentData.email || !newStudentData.register_number || 
           !newStudentData.department_id || !selectedStartYear || !selectedEndYear || !selectedSection || !newStudentPassword;
  }, [newStudentData, selectedStartYear, selectedEndYear, selectedSection, newStudentPassword]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Students...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we fetch student data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle>Student Management</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={setSelectedDepartment} defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={setSelectedBatch} defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batches.map((batch) => {
                const fullBatchName = batch.section
                  ? `${batch.name} ${batch.section}`
                  : batch.name;
                return (
                  <SelectItem key={batch.id} value={fullBatchName}>
                    {fullBatchName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={downloadStudentTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Bulk Upload Students</DialogTitle>
                {/* Removed DialogDescription */}
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Removed BulkUploadWorkflow component */}
                
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="student-file">Select Completed XLSX File</Label>
                  <Input
                    id="student-file"
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleFileUpload} disabled={!uploadFile}>
                  Upload and Process
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddSingleStudentDialogOpen} onOpenChange={handleAddStudentDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="default">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Single Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>
                  Fill in the details to add a new student to the system.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={newStudentData.first_name}
                      onChange={(e) => setNewStudentData({ ...newStudentData, first_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={newStudentData.last_name || ""}
                      onChange={(e) => setNewStudentData({ ...newStudentData, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={newStudentData.username || ""}
                    onChange={(e) => setNewStudentData({ ...newStudentData, username: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudentData.email || ""}
                    onChange={(e) => setNewStudentData({ ...newStudentData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={newStudentData.phone_number || ""}
                    onChange={(e) => setNewStudentData({ ...newStudentData, phone_number: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="register_number">Register Number</Label>
                  <Input
                    id="register_number"
                    value={newStudentData.register_number || ""}
                    onChange={(e) => setNewStudentData({ ...newStudentData, register_number: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parent_name">Parent Name</Label>
                  <Input
                    id="parent_name"
                    value={newStudentData.parent_name || ""}
                    onChange={(e) => setNewStudentData({ ...newStudentData, parent_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department_id">Department</Label>
                  <Select
                    value={newStudentData.department_id || ""}
                    onValueChange={(value) => {
                      setNewStudentData({ ...newStudentData, department_id: value, batch_id: "" });
                      setSelectedStartYear("");
                      setSelectedEndYear("");
                      setSelectedSection("");
                    }}
                    required
                  >
                    <SelectTrigger id="department_id">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="batch_start_year">Batch Start Year</Label>
                    <Select
                      value={selectedStartYear}
                      onValueChange={(value) => {
                        setSelectedStartYear(value);
                        setSelectedSection("");
                      }}
                      disabled={!newStudentData.department_id}
                      required
                    >
                      <SelectTrigger id="batch_start_year">
                        <SelectValue placeholder="Start Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="batch_end_year">Batch End Year</Label>
                    <Select
                      value={selectedEndYear}
                      onValueChange={(value) => {
                        setSelectedEndYear(value);
                        setSelectedSection("");
                      }}
                      disabled={!newStudentData.department_id}
                      required
                    >
                      <SelectTrigger id="batch_end_year">
                        <SelectValue placeholder="End Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="batch_section">Section</Label>
                  <Select
                    value={selectedSection}
                    onValueChange={(value) => {
                      setSelectedSection(value);
                      // Note: We don't need to update newStudentData.batch_id here, 
                      // as findMatchingBatch() handles the check on submission.
                    }}
                    disabled={!selectedStartYear || !selectedEndYear}
                    required
                  >
                    <SelectTrigger id="batch_section">
                      <SelectValue placeholder="Select Section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section} value={section}>
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Display matching batch info */}
                <div className="text-sm text-muted-foreground">
                  {newStudentData.department_id && selectedStartYear && selectedEndYear && selectedSection ? (
                    findMatchingBatch() ? (
                      <p className="text-green-600 dark:text-green-400">Batch found: {findMatchingBatch()?.name} {findMatchingBatch()?.section || ""}</p>
                    ) : (
                      <p className="text-orange-600 dark:text-orange-400">Batch not found. It will be created automatically upon submission.</p>
                    )
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tutor_id">Tutor (Optional)</Label>
                  <Select
                    key={newStudentData.department_id + "-tutor"}
                    value={newStudentData.tutor_id || "unassigned"}
                    onValueChange={(value) => setNewStudentData({ ...newStudentData, tutor_id: value === "unassigned" ? undefined : value })}
                    disabled={!newStudentData.department_id}
                  >
                    <SelectTrigger id="tutor_id">
                      <SelectValue placeholder="Select Tutor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {filteredTutorsByDepartment.length > 0 ? (
                        filteredTutorsByDepartment.map((tutor) => (
                          <SelectItem key={tutor.id} value={tutor.id}>
                            {`${tutor.first_name} ${tutor.last_name || ''}`.trim()}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-tutors" disabled>
                          No tutors for this department
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hod_id">HOD (Optional)</Label>
                  <Select
                    key={newStudentData.department_id + "-hod"}
                    value={newStudentData.hod_id || "unassigned"}
                    onValueChange={(value) => setNewStudentData({ ...newStudentData, hod_id: value === "unassigned" ? undefined : value })}
                    disabled={!newStudentData.department_id}
                  >
                    <SelectTrigger id="hod_id">
                      <SelectValue placeholder="Select HOD" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {filteredHodsByDepartment.length > 0 ? (
                        filteredHodsByDepartment.map((hod) => (
                          <SelectItem key={hod.id} value={hod.id}>
                            {`${hod.first_name} ${hod.last_name || ''}`.trim()}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-hods" disabled>
                          No HODs for this department
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={newStudentPassword}
                      onChange={(e) => setNewStudentPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-primary/10"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleAddSingleStudent} disabled={isAddStudentButtonDisabled}>
                  Add Student
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Register No.</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => (
                <TableRow key={student.register_number}>
                  <TableCell className="font-medium">
                    {student.register_number}
                  </TableCell>
                  <TableCell>{`${student.first_name} ${student.last_name || ''}`.trim()}</TableCell>
                  <TableCell>{student.department_name}</TableCell>
                  <TableCell>{student.batch_name}</TableCell>
                  <TableCell>{student.tutor_name}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Student</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Remove Student
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No students found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default StudentManagement;