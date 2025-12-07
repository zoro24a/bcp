import { useState, useMemo, useEffect } from "react";
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
import { Eye, EyeOff, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription, // Added DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchProfiles,
  fetchBatches,
  fetchDepartments,
  createTutor,
  updateTutor,
  deleteTutor,
  updateUserPassword, // New import
} from "@/data/appData";
import { Profile, Department, Batch } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";

const ManageTutors = () => {
  const [tutors, setTutors] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [editingTutor, setEditingTutor] = useState<Profile | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  // Removed selectedBatchId state
  const [tutorPassword, setTutorPassword] = useState("");
  const [showTutorPassword, setShowTutorPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    setLoading(true);
    const fetchedTutors = await fetchProfiles('tutor');
    const fetchedDepartments = await fetchDepartments();
    const fetchedBatches = await fetchBatches();

    setTutors(fetchedTutors);
    setDepartments(fetchedDepartments);
    setBatches(fetchedBatches);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Removed uniqueBatchNames and availableSections memoization as they are no longer needed here

  const openEditDialog = (tutor: Profile) => {
    setEditingTutor(tutor);
    setSelectedDepartmentId(tutor.department_id || "");
    // Removed setSelectedBatchId
    setTutorPassword(""); // Clear password field when opening edit dialog
    setIsAddEditDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTutor(null);
    setSelectedDepartmentId("");
    // Removed setSelectedBatchId
    setTutorPassword(""); // Clear password field when opening add dialog
    setIsAddEditDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const tutorProfileData: Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'role' | 'batch_id'> = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      phone_number: formData.get("phone_number") as string,
      department_id: selectedDepartmentId,
      // Removed batch_id assignment
    };

    if (editingTutor) {
      // Update profile details
      const updatedProfile = await updateTutor(editingTutor.id, tutorProfileData);
      if (!updatedProfile) {
        showError("Failed to update tutor details.");
        return;
      }

      // Update password if provided
      if (tutorPassword) {
        const passwordUpdated = await updateUserPassword(editingTutor.id, tutorPassword);
        if (!passwordUpdated) {
          showError("Failed to update tutor password.");
          // Continue with profile update success, but log password error
        }
      }
      showSuccess("Tutor details updated successfully.");
      fetchAllData();
    } else {
      // Create new tutor
      if (!tutorPassword) {
        showError("Password is required for new tutors.");
        return;
      }
      const created = await createTutor({ ...tutorProfileData, role: 'tutor' }, tutorPassword);
      if (created) {
        showSuccess("New tutor added successfully.");
        fetchAllData();
      } else {
        showError("Failed to add new tutor.");
      }
    }

    setIsAddEditDialogOpen(false);
    setEditingTutor(null);
    setTutorPassword(""); // Clear password field
  };

  const handleDelete = async (tutorId: string, tutorName: string) => {
    const deleted = await deleteTutor(tutorId);
    if (deleted) {
      showSuccess(`Tutor "${tutorName}" removed successfully.`);
      fetchAllData();
    } else {
      showError("Failed to remove tutor.");
    }
  };

  // Helper function to find assigned batches for display
  const getAssignedBatchesDisplay = (tutorId: string) => {
    const assigned = batches.filter(b => b.tutor_id === tutorId);
    if (assigned.length === 0) return { fullBatchName: "N/A", currentSemester: "N/A", academicYearRange: "N/A" };

    // Display the first assigned batch details for simplicity in the table row
    const firstBatch = assigned[0];
    const fullBatchName = assigned.map(b => `${b.name} ${b.section || ''}`.trim()).join(', ');
    const academicYearRange = firstBatch.name || "N/A";
    const currentSemester = firstBatch.current_semester || "N/A";

    return { fullBatchName, currentSemester, academicYearRange };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Tutors...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we fetch tutor data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Manage Staff (Tutors)</CardTitle>
        <Dialog
          open={isAddEditDialogOpen}
          onOpenChange={(isOpen) => {
            setIsAddEditDialogOpen(isOpen);
            if (!isOpen) {
              setEditingTutor(null);
              setTutorPassword(""); // Clear password on dialog close
              setShowTutorPassword(false); // Reset password visibility
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>Add New Tutor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTutor ? "Edit Tutor Details" : "Add New Tutor"}
              </DialogTitle>
              <DialogDescription>
                {editingTutor ? "Update the details for this tutor." : "Fill in the details to add a new tutor to the system. Batch assignment is managed separately in Batch Management."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      defaultValue={editingTutor?.first_name || ""}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      defaultValue={editingTutor?.last_name || ""}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    defaultValue={editingTutor?.username || ""}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={selectedDepartmentId}
                    onValueChange={setSelectedDepartmentId}
                    required
                  >
                    <SelectTrigger id="department">
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
                {/* Removed Batch Assignment fields */}
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingTutor?.email || ""}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    defaultValue={editingTutor?.phone_number || ""}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password {editingTutor ? "(Leave blank to keep current)" : ""}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showTutorPassword ? "text" : "password"}
                      value={tutorPassword}
                      onChange={(e) => setTutorPassword(e.target.value)}
                      required={!editingTutor} // Required only for new tutors
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-primary/10"
                      onClick={() => setShowTutorPassword((prev) => !prev)}
                    >
                      {showTutorPassword ? (
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
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Batch Assigned</TableHead>
              <TableHead>Current Sem</TableHead>
              <TableHead>Academic Year Range</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tutors.length > 0 ? (
              tutors.map((tutor) => {
                const departmentName = departments.find(d => d.id === tutor.department_id)?.name || "N/A";
                const { fullBatchName, currentSemester, academicYearRange } = getAssignedBatchesDisplay(tutor.id);

                return (
                  <TableRow key={tutor.id}>
                    <TableCell className="font-medium">{`${tutor.first_name} ${tutor.last_name || ''}`.trim()}</TableCell>
                    <TableCell>{departmentName}</TableCell>
                    <TableCell>{fullBatchName}</TableCell>
                    <TableCell>{currentSemester}</TableCell>
                    <TableCell>{academicYearRange}</TableCell>
                    <TableCell>{tutor.email}</TableCell>
                    <TableCell>{tutor.phone_number}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => openEditDialog(tutor)}>
                              Edit Details
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-destructive">
                                Remove Tutor
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently
                              remove {`${tutor.first_name} ${tutor.last_name || ''}`.trim()} from the records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(tutor.id, `${tutor.first_name} ${tutor.last_name || ''}`.trim())}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  No tutors found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ManageTutors;