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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Edit, Trash2, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Department, Profile } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
import { createDepartment, fetchDepartments, updateDepartment, updateHodAssignment, fetchProfiles, fetchAllStudentsWithDetails } from "@/data/appData";
import { supabase } from "@/integrations/supabase/client";

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [tutorCounts, setTutorCounts] = useState<Record<string, number>>({});

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newEstablishedYear, setNewEstablishedYear] = useState<number | ''>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [editYear, setEditYear] = useState<number | ''>('');
  const [editHodId, setEditHodId] = useState<string>("none");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const depts = await fetchDepartments();
      const tutors = await fetchProfiles("tutor");
      const hods = await fetchProfiles("hod");
      const students = await fetchAllStudentsWithDetails();

      setDepartments(depts);
      setAllProfiles([...tutors, ...hods]);

      // Calculate counts
      const sCounts: Record<string, number> = {};
      const tCounts: Record<string, number> = {};

      students.forEach(s => {
        if (s.department_id) {
          sCounts[s.department_id] = (sCounts[s.department_id] || 0) + 1;
        }
      });

      tutors.forEach(t => {
        if (t.department_id) {
          tCounts[t.department_id] = (tCounts[t.department_id] || 0) + 1;
        }
      });

      setStudentCounts(sCounts);
      setTutorCounts(tCounts);
    } catch (err: any) {
      showError("Failed to fetch data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDepartment = async () => {
    if (newDepartmentName.trim() === "") {
      showError("Department name is required.");
      return;
    }

    const payload: Omit<Department, 'id' | 'created_at'> = {
      name: newDepartmentName,
      established_year: newEstablishedYear === '' ? undefined : newEstablishedYear,
    };

    const created = await createDepartment(payload);

    if (created) {
      showSuccess(`Department "${newDepartmentName}" created.`);
      setNewDepartmentName("");
      setNewEstablishedYear('');
      setIsDialogOpen(false);
      fetchData();
    } else {
      showError("Failed to create department.");
    }
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditYear(dept.established_year || '');

    const currentHod = allProfiles.find(p => p.department_id === dept.id && p.role === 'hod');
    setEditHodId(currentHod?.id || "none");

    setIsEditDialogOpen(true);
  };

  const handleUpdateDepartment = async () => {
    if (!editingDept) return;

    if (editName.trim() === "") {
      showError("Department name is required.");
      return;
    }

    try {
      // 1. Update basic info
      const updated = await updateDepartment(editingDept.id, {
        name: editName,
        established_year: editYear === '' ? undefined : editYear,
      });

      if (!updated) throw new Error("Update failed");

      // 2. Update HOD if changed
      const currentHod = allProfiles.find(p => p.department_id === editingDept.id && p.role === 'hod');
      if (editHodId !== (currentHod?.id || "none")) {
        if (editHodId === "none") {
          // Remove existing HOD role if "none" selected
          if (currentHod) {
            await supabase.from("profiles").update({ role: "tutor" }).eq("id", currentHod.id);
          }
        } else {
          const success = await updateHodAssignment(editingDept.id, editHodId);
          if (!success) throw new Error("Failed to assign HOD");
        }
      }

      showSuccess("Department updated successfully.");
      setIsEditDialogOpen(false);
      fetchData();
    } catch (err: any) {
      showError("Failed to update department: " + err.message);
    }
  };

  const handleDeleteDepartment = async (departmentId: string, departmentName: string) => {
    if (!confirm(`Are you sure you want to delete ${departmentName}?`)) return;

    const { error } = await supabase.from('departments').delete().eq('id', departmentId);
    if (error) {
      showError("Failed to delete department: " + error.message);
    } else {
      showSuccess(`Department "${departmentName}" deleted.`);
      fetchData();
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Department Management</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <div className="text-muted-foreground animate-pulse text-lg">Loading departments...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Departments</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" /> Add New Department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Department</DialogTitle>
              <DialogDescription>
                Add a new academic department to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-name">Department Name</Label>
                <Input
                  id="new-name"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="e.g., Computer Science"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-year">Established Year</Label>
                <Input
                  id="new-year"
                  type="number"
                  value={newEstablishedYear}
                  onChange={(e) => setNewEstablishedYear(Number(e.target.value) || '')}
                  placeholder="e.g., 2005"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleAddDepartment}>Create Department</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department Name</TableHead>
                <TableHead>HOD</TableHead>
                <TableHead className="text-center">Est. Year</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="text-center">Tutors</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length > 0 ? (
                departments.map((dept) => {
                  const hod = allProfiles.find(p => p.department_id === dept.id && p.role === 'hod');
                  return (
                    <TableRow key={dept.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-semibold">{dept.name}</TableCell>
                      <TableCell>
                        {hod ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{hod.name || `${hod.first_name} ${hod.last_name || ''}`.trim()}</span>
                            <span className="text-xs text-muted-foreground">{hod.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Not Assigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{dept.established_year || "N/A"}</TableCell>
                      <TableCell className="text-center">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
                          {studentCounts[dept.id] || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs font-medium">
                          {tutorCounts[dept.id] || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(dept)} className="gap-2">
                              <Edit className="h-4 w-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive gap-2"
                              onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No departments available. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Modify department details and assign Head of Department.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Department Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-year">Established Year</Label>
              <Input
                id="edit-year"
                type="number"
                value={editYear}
                onChange={(e) => setEditYear(Number(e.target.value) || '')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-hod">Assign HOD</Label>
              <Select value={editHodId} onValueChange={setEditHodId}>
                <SelectTrigger id="edit-hod">
                  <SelectValue placeholder="Select HOD" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No HOD Assigned</SelectItem>
                  {allProfiles
                    .filter(p => p.department_id === editingDept?.id || p.department_id === null)
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name || `${profile.first_name} ${profile.last_name || ''}`.trim()} ({profile.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpdateDepartment}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentManagement;
