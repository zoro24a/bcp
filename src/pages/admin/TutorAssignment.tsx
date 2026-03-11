import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
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
import { Label } from "@/components/ui/label";
import { Trash2, UserPlus, PenTool } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import {
    fetchDepartments,
    fetchBatches,
    fetchProfiles,
    fetchTutorAssignments,
    createTutorAssignment,
    updateTutorAssignment,
    deleteTutorAssignment,
} from "@/data/appData";
import { Department, Batch, Profile, TutorAssignment } from "@/lib/types";

const TutorAssignmentPage = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [tutors, setTutors] = useState<Profile[]>([]);
    const [assignments, setAssignments] = useState<TutorAssignment[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>(undefined);
    const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);
    const [selectedSemester, setSelectedSemester] = useState<string | undefined>(undefined);
    const [selectedTutorId, setSelectedTutorId] = useState<string | undefined>(undefined);
    const [editingAssignment, setEditingAssignment] = useState<TutorAssignment | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [deptsData, tutorsData, assignmentsData] = await Promise.all([
                fetchDepartments(),
                fetchProfiles("tutor"),
                fetchTutorAssignments(),
            ]);
            setDepartments(deptsData);
            setTutors(tutorsData);
            setAssignments(assignmentsData);
        } catch (error: any) {
            showError("Failed to fetch data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const loadBatches = async () => {
            if (selectedDeptId) {
                const data = await fetchBatches(selectedDeptId);
                setBatches(data);
            } else {
                setBatches([]);
            }
        };
        loadBatches();
    }, [selectedDeptId]);

    // Use a Map to ensure unique batches based on their name and section combination
    const uniqueBatches = useMemo(() => {
        const map = new Map();
        batches.forEach(b => {
            const key = `${b.name}-${b.section || 'NoSection'}`;
            if (!map.has(key)) {
                map.set(key, b);
            }
        });
        return Array.from(map.values());
    }, [batches]);

    const availableTutors = useMemo(() => {
        return tutors.filter((t) => t.department_id === selectedDeptId);
    }, [tutors, selectedDeptId]);

    const handleAssign = async () => {
        if (!selectedBatchId || !selectedSemester || !selectedTutorId) {
            showError("Please fill in all fields.");
            return;
        }

        const batch = batches.find((b) => b.id === selectedBatchId);
        if (!batch) return;

        const academicYear = batch.name; // e.g. "2024-2028"
        const section = batch.section || "No Section";

        const assignmentPayload = {
            batch_id: selectedBatchId,
            section: section,
            semester: parseInt(selectedSemester),
            tutor_id: selectedTutorId,
            academic_year: academicYear,
        };

        if (editingAssignment) {
            const result = await updateTutorAssignment(editingAssignment.id, assignmentPayload);
            if (result) {
                showSuccess("Assignment updated successfully!");
                setIsEditDialogOpen(false);
                setEditingAssignment(null);
                fetchData();
                resetForm();
            } else {
                showError("Failed to update assignment.");
            }
        } else {
            const result = await createTutorAssignment(assignmentPayload);
            if (result) {
                showSuccess("Tutor assigned successfully!");
                fetchData();
                resetForm();
            } else {
                showError("Failed to assign tutor. A duplicate assignment might exist.");
            }
        }
    };

    const handleEdit = (assignment: TutorAssignment) => {
        setEditingAssignment(assignment);
        setSelectedDeptId(assignment.batch?.department_id || "");
        setSelectedBatchId(assignment.batch_id);
        setSelectedSemester(String(assignment.semester));
        setSelectedTutorId(assignment.tutor_id);
    };

    const resetForm = () => {
        setSelectedSemester(undefined);
        setSelectedTutorId(undefined);
        setEditingAssignment(null);
    };

    const handleDelete = async (id: string) => {
        const success = await deleteTutorAssignment(id);
        if (success) {
            showSuccess("Assignment removed successfully.");
            fetchData();
        } else {
            showError("Failed to remove assignment.");
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Assign Tutor to Batch</CardTitle>
                    <CardDescription>
                        Select a batch, semester, and tutor to create a new assignment.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={selectedDeptId || ""} onValueChange={(val) => {
                                setSelectedDeptId(val);
                                setSelectedBatchId(undefined);
                                setSelectedTutorId(undefined);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Dept" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Batch & Section</Label>
                            <Select
                                value={selectedBatchId || ""}
                                onValueChange={setSelectedBatchId}
                                disabled={!selectedDeptId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Batch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueBatches.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name} - Section {b.section || "A"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Semester</Label>
                            <Select value={selectedSemester || ""} onValueChange={setSelectedSemester}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Semester" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                        <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Tutor</Label>
                            <Select
                                value={selectedTutorId || ""}
                                onValueChange={setSelectedTutorId}
                                disabled={!selectedDeptId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Tutor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTutors.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {`${t.first_name} ${t.last_name || ''}`.trim()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end gap-2">
                            <Button onClick={handleAssign} className="w-full gap-2">
                                {editingAssignment ? "Update Assignment" : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        Assign
                                    </>
                                )}
                            </Button>
                            {editingAssignment && (
                                <Button variant="outline" onClick={resetForm}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Existing Assignments</CardTitle>
                    <CardDescription>
                        List of current tutor assignments per batch and semester.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Batch</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Semester</TableHead>
                                <TableHead>Tutor</TableHead>
                                <TableHead>Academic Year</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assignments.length > 0 ? (
                                assignments.map((a) => (
                                    <TableRow key={a.id}>
                                        <TableCell className="font-medium">{a.batch?.name || "N/A"}</TableCell>
                                        <TableCell>{a.section}</TableCell>
                                        <TableCell>Semester {a.semester}</TableCell>
                                        <TableCell>
                                            {a.tutor ? `${a.tutor.first_name} ${a.tutor.last_name || ''}`.trim() : "N/A"}
                                        </TableCell>
                                        <TableCell>{a.academic_year}</TableCell>
                                        <TableCell className="text-right flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(a)}
                                                className="text-primary hover:text-primary/90"
                                            >
                                                <PenTool className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(a.id)}
                                                className="text-destructive hover:text-destructive/90"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                        No assignments found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default TutorAssignmentPage;
