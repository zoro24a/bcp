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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  fetchAllStudentsWithDetails,
  fetchBatches,
  fetchDepartments,
  createStudent,
  fetchProfiles,
  createBatch,
  fetchDepartmentByName, // New import
  fetchBatchByNameAndDepartment, // New import
  fetchProfileByNameAndRole, // New import
} from "@/data/appData";
import { Download, MoreHorizontal, Upload, UserPlus, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadStudentTemplate, parseStudentFile } from "@/lib/xlsx";
import { showError, showSuccess } from "@/utils/toast";
import { StudentDetails, Department, Batch, Profile } from "@/lib/types";
import { calculateCurrentSemesterForBatch, getSemesterDateRange } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

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
    gender: "Male",
    tutor_id: undefined,
    hod_id: undefined,
  });
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedStartYear, setSelectedStartYear] = useState("");
  const [selectedEndYear, setSelectedEndYear] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkUploadErrors, setBulkUploadErrors] = useState<string[]>([]);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  const [isBulkUploading, setIsBulkUploading] = useState(false);


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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setUploadFile(event.target.files[0]);
    } else {
      setUploadFile(null);
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) {
      showError("Please select a file to upload.");
      return;
    }

    setIsBulkUploading(true);
    setBulkUploadErrors([]);
    setBulkUploadProgress(0);
    const errors: string[] = [];
    let successfulUploads = 0;

    try {
      const parsedStudents = await parseStudentFile(uploadFile);
      const totalStudentsToUpload = parsedStudents.length;

      for (let i = 0; i < totalStudentsToUpload; i++) {
        const student = parsedStudents[i];
        const rowNumber = i + 2; // +1 for 0-index to 1-index, +1 for header row

        if (!student.email || !student.register_number || !student.first_name || !student.department_name || !student.batch_name || !student.password) {
          errors.push(`Row ${rowNumber}: Missing required fields (email, register_number, first_name, department_name, batch_name, password).`);
          continue;
        }

        // 1. Resolve Department ID
        let department = departments.find(d => d.name === student.department_name);
        if (!department) {
          department = await fetchDepartmentByName(student.department_name);
          if (!department) {
            errors.push(`Row ${rowNumber}: Department '${student.department_name}' not found.`);
            continue;
          }
        }

        // 2. Resolve Batch ID (and create if not exists)
        const batchNameParts = student.batch_name.split(' '); // e.g., "2024-2028 A" -> ["2024-2028", "A"]
        const batchName = batchNameParts[0];
        const section = batchNameParts.length > 1 ? batchNameParts[1] : "No Section";
        
        let batch = batches.find(
          b => b.name === batchName && b.department_id === department?.id && (b.section === section || (section === "No Section" && b.section === null))
        );

        if (!batch) {
          const currentSemester = calculateCurrentSemesterForBatch(student.batch_name);
          const { from, to } = getSemesterDateRange(student.batch_name, currentSemester);

          const createdBatch = await createBatch({
            name: batchName,
            section: section === "No Section" ? null : section,
            tutor_id: null, // Tutors assigned separately
            total_sections: 1, // Default to 1, can be updated later
            student_count: 0,
            status: "Active",
            current_semester: currentSemester,
            semester_from_date: from,
            semester_to_date: to,
            department_id: department.id,
          });

          if (!createdBatch) {
            errors.push(`Row ${rowNumber}: Failed to create batch '${student.batch_name}'.`);
            continue;
          }
          batch = createdBatch;
          // Refresh batches list to include the newly created batch for subsequent students
          setBatches(prev => [...prev, createdBatch]);
        }

        // 3. Resolve Tutor ID (optional)
        let tutorId: string | undefined = undefined;
        if (student.tutor_name) {
          const [tutorFirstName, ...tutorLastNameParts] = student.tutor_name.split(' ');
          const tutorLastName = tutorLastNameParts.join(' ') || undefined;
          const tutorProfile = await fetchProfileByNameAndRole(tutorFirstName, tutorLastName, 'tutor');
          if (tutorProfile) {
            tutorId = tutorProfile.id;
          } else {
            errors.push(`Row ${rowNumber}: Tutor '${student.tutor_name}' not found. Student will be unassigned from tutor.`);
          }
        }

        // 4. Resolve HOD ID (optional)
        let hodId: string | undefined = undefined;
        if (student.hod_name) {
          const [hodFirstName, ...hodLastNameParts] = student.hod_name.split(' ');
          const hodLastName = hodLastNameParts.join(' ') || undefined;
          const hodProfile = await fetchProfileByNameAndRole(hodFirstName, hodLastName, 'hod');
          if (hodProfile) {
            hodId = hodProfile.id;
          } else {
            errors.push(`Row ${rowNumber}: HOD '${student.hod_name}' not found. Student will be unassigned from HOD.`);
          }
        }

        // 5. Create Student
        const studentProfileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'> = {
          first_name: student.first_name,
          last_name: student.last_name,
          username: student.username || `${student.first_name}.${student.register_number}`,
          email: student.email,
          phone_number: student.phone_number,
          department_id: department.id,
          batch_id: batch.id,
          gender: student.gender || "Male",
          role: 'student',
        };

        const studentSpecificData = {
          register_number: student.register_number,
          parent_name: student.parent_name,
          batch_id: batch.id,
          tutor_id: tutorId,
          hod_id: hodId,
        };

        const result = await createStudent(studentProfileData, studentSpecificData, student.password);

        if (result && 'error' in result) {
          errors.push(`Row ${rowNumber}: ${result.error}`);
        } else if (result) {
          successfulUploads++;
        }
        setBulkUploadProgress(Math.round(((i + 1) / totalStudentsToUpload) * 100));
      }

      if (successfulUploads > 0) {
        showSuccess(`${successfulUploads} students uploaded successfully!`);
      }
      if (errors.length > 0) {
        showError(`Finished with ${errors.length} errors. See details below.`);
        setBulkUploadErrors(errors);
      } else if (successfulUploads === 0) {
        showError("No students were uploaded. Please check the file and try again.");
      }
      
      setUploadFile(null);
      setIsUploadDialogOpen(false);
      fetchAllData(); // Refresh the student list
    } catch (error: any) {
      showError("Failed to process bulk upload: " + error.message);
      errors.push("Failed to process bulk upload: " + error.message);
      setBulkUploadErrors(errors);
    } finally {
      setIsBulkUploading(false);
      setBulkUploadProgress(0);
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
      const batchName = `${selectedStartYear}-${selectedEndYear}`;
      const sectionName = selectedSection === "No Section" ? null : selectedSection;
      const fullBatchName = sectionName ? `${batchName} ${sectionName}` : batchName;
      
      const currentSemester = calculateCurrentSemesterForBatch(fullBatchName);
      const { from, to } = getSemesterDateRange(fullBatchName, currentSemester);

      const createdBatch = await createBatch({
        name: batchName,
        section: sectionName,
        tutor_id: newStudentData.tutor_id === "unassigned" ? undefined : newStudentData.tutor_id,
        total_sections: 1,
        student_count: 1,
        status: "Active",
        current_semester: currentSemester,
        semester_from_date: from,
        semester_to_date: to,
        department_id: newStudentData.department_id!,
      });

      if (!createdBatch) {
        showError("Failed to create batch.");
        return;
      }
      batchIdToUse = createdBatch.id;
    } else {
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
        gender: newStudentData.gender,
        role: 'student',
      },
      {
        register_number: newStudentData.register_number!,
        parent_name: newStudentData.parent_name,
        batch_id: batchIdToUse,
        tutor_id: newStudentData.tutor_id === "unassigned" ? undefined : newStudentData.tutor_id,
        hod_id: newStudentData.hod_id === "unassigned" ? undefined : newStudentData.hod_id,
      },
      newStudentPassword
    );

    if (result && 'error' in result) {
      showError(result.error);
    } else if (result) {
      showSuccess(`Student added successfully!`);
      setIsAddSingleStudentDialogOpen(false);
      fetchAllData();
    }
  };

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
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={`${batch.name} ${batch.section || ''}`.trim()}>
                  {`${batch.name} ${batch.section || ''}`.trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={downloadStudentTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Upload className="mr-2 h-4 w-4" />
                Bulk Upload Students
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Bulk Upload Students</DialogTitle>
                <DialogDescription>
                  Upload an XLSX file containing student data. Please use the provided template.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input id="file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
                {isBulkUploading && (
                  <div className="text-center text-sm text-muted-foreground">
                    Uploading: {bulkUploadProgress}%
                  </div>
                )}
                {bulkUploadErrors.length > 0 && (
                  <ScrollArea className="h-40 w-full rounded-md border p-4 text-sm text-destructive">
                    <p className="font-semibold mb-2">Errors encountered:</p>
                    <ul className="list-disc list-inside">
                      {bulkUploadErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isBulkUploading}>Cancel</Button>
                </DialogClose>
                <Button onClick={handleBulkUpload} disabled={!uploadFile || isBulkUploading}>
                  {isBulkUploading ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddSingleStudentDialogOpen} onOpenChange={setIsAddSingleStudentDialogOpen}>
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
                  <Label>Gender</Label>
                  <RadioGroup 
                    defaultValue="Male" 
                    className="flex gap-4"
                    onValueChange={(val) => setNewStudentData({ ...newStudentData, gender: val as "Male" | "Female" })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Male" id="male" />
                      <Label htmlFor="male">Male</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Female" id="female" />
                      <Label htmlFor="female">Female</Label>
                    </div>
                  </RadioGroup>
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
                    onValueChange={(value) => setNewStudentData({ ...newStudentData, department_id: value })}
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
                    <Select value={selectedStartYear} onValueChange={setSelectedStartYear}>
                      <SelectTrigger><SelectValue placeholder="Start Year" /></SelectTrigger>
                      <SelectContent>
                        {years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="batch_end_year">Batch End Year</Label>
                    <Select value={selectedEndYear} onValueChange={setSelectedEndYear}>
                      <SelectTrigger><SelectValue placeholder="End Year" /></SelectTrigger>
                      <SelectContent>
                        {years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="batch_section">Section</Label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => <SelectItem key={section} value={section}>{section}</SelectItem>)}
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
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAddSingleStudent}>Add Student</Button>
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
              <TableHead>Gender</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow key={student.id}>
                <TableCell>{student.register_number}</TableCell>
                <TableCell>{`${student.first_name} ${student.last_name || ''}`.trim()}</TableCell>
                <TableCell>{student.gender || "Male"}</TableCell>
                <TableCell>{student.department_name}</TableCell>
                <TableCell>{student.batch_name}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default StudentManagement;