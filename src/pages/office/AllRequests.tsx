import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchStudentDetails, fetchRequests, fetchDepartments } from "@/data/appData";
import { BonafideRequest, StudentDetails, Department } from "@/lib/types";
import { showError } from "@/utils/toast";
import { formatDateToIndian } from "@/lib/utils";
import { useSession } from "@/components/auth/SessionContextProvider";
import { ArrowUpDown, RotateCcw, Filter } from "lucide-react";

const OfficeAllRequests = () => {
    const { user } = useSession();
    const [requests, setRequests] = useState<BonafideRequest[]>([]);
    const [studentDetailsMap, setStudentDetailsMap] = useState<Map<string, StudentDetails>>(new Map());
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter and Sort states
    const [deptFilter, setDeptFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<string>("");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pendingIssue, fetchedDepts] = await Promise.all([
                fetchRequests("Ready for Issue"),
                fetchDepartments()
            ]);

            setRequests(pendingIssue);
            setDepartments(fetchedDepts);

            if (pendingIssue.length > 0) {
                const uniqueStudentIds = Array.from(new Set(pendingIssue.map(r => r.student_id)));
                const detailsPromises = uniqueStudentIds.map(id => fetchStudentDetails(id));
                const detailsResults = await Promise.all(detailsPromises);

                const newMap = new Map<string, StudentDetails>();
                detailsResults.forEach(detail => {
                    if (detail) newMap.set(detail.id, detail);
                });
                setStudentDetailsMap(newMap);
            }
        } catch (err: any) {
            showError("Failed to load data: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const filteredAndSortedRequests = useMemo(() => {
        let result = [...requests];

        // 1. Filter by Department
        if (deptFilter !== "all") {
            result = result.filter(req => {
                const student = studentDetailsMap.get(req.student_id);
                return student?.department_id === deptFilter;
            });
        }

        // 2. Filter by Date
        if (dateFilter) {
            result = result.filter(req => {
                const reqDate = req.created_at || req.date;
                return reqDate.startsWith(dateFilter);
            });
        }

        // 3. Sort by Approved Date
        result.sort((a, b) => {
            const dateA = new Date(a.created_at || a.date).getTime();
            const dateB = new Date(b.created_at || b.date).getTime();
            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });

        return result;
    }, [requests, studentDetailsMap, deptFilter, dateFilter, sortOrder]);

    const resetFilters = () => {
        setDeptFilter("all");
        setDateFilter("");
        setSortOrder("desc");
    };

    const toggleSort = () => {
        setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading Requests...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">All Requests (Ready for Issue)</h1>
                <Button variant="outline" size="sm" onClick={resetFilters} className="w-fit gap-2">
                    <RotateCcw className="h-4 w-4" /> Reset Filters
                </Button>
            </div>

            <Card className="glass-card">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="flex-1 space-y-2">
                            <Label className="flex items-center gap-2">
                                <Filter className="h-4 w-4" /> Filter by Department
                            </Label>
                            <Select value={deptFilter} onValueChange={setDeptFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <Label>Filter by Date</Label>
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Register Number</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead onClick={toggleSort} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        Approved Date <ArrowUpDown className="h-4 w-4" />
                                    </div>
                                </TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedRequests.length > 0 ? (
                                filteredAndSortedRequests.map((request) => {
                                    const student = studentDetailsMap.get(request.student_id);
                                    return (
                                        <TableRow key={request.id}>
                                            <TableCell className="font-medium">
                                                {student ? `${student.first_name} ${student.last_name || ''}`.trim() : "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                {student?.register_number || "N/A"}
                                            </TableCell>
                                            <TableCell>{student?.department_name || "N/A"}</TableCell>
                                            <TableCell>{formatDateToIndian(request.created_at || request.date)}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                                    {request.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        No requests found matching the current filters.
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

export default OfficeAllRequests;
