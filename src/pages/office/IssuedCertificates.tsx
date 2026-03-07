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
    DialogFooter,
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
import { fetchStudentDetails, fetchTemplates, fetchRequests, fetchDepartments } from "@/data/appData";
import { BonafideRequest, StudentDetails, CertificateTemplate, Department } from "@/lib/types";
import { showError } from "@/utils/toast";
import { getCertificateHtml, generatePdf, printHtml } from "@/lib/pdf";
import { formatDateToIndian } from "@/lib/utils";
import { useSession } from "@/components/auth/SessionContextProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Download, Printer, ArrowUpDown, Filter, RotateCcw } from "lucide-react";

const IssuedCertificates = () => {
    const { user } = useSession();
    const [requests, setRequests] = useState<BonafideRequest[]>([]);
    const [studentDetailsMap, setStudentDetailsMap] = useState<Map<string, StudentDetails>>(new Map());
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter and Sort states
    const [deptFilter, setDeptFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<string>("");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const [selectedRequest, setSelectedRequest] = useState<BonafideRequest | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string>("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [issuedRequests, fetchedDepts, fetchedTemplates] = await Promise.all([
                fetchRequests("Issued"),
                fetchDepartments(),
                fetchTemplates()
            ]);

            setRequests(issuedRequests);
            setDepartments(fetchedDepts);
            setTemplates(fetchedTemplates);

            if (issuedRequests.length > 0) {
                const uniqueStudentIds = Array.from(new Set(issuedRequests.map(r => r.student_id)));
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

        // 2. Filter by Date (Issue Date)
        if (dateFilter) {
            result = result.filter(req => {
                const reqDate = req.issued_at || req.created_at || req.date;
                return reqDate.startsWith(dateFilter);
            });
        }

        // 3. Sort by Issue Date
        result.sort((a, b) => {
            const dateA = new Date(a.issued_at || a.created_at || a.date).getTime();
            const dateB = new Date(b.issued_at || b.created_at || b.date).getTime();
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

    const handlePreview = async (request: BonafideRequest) => {
        const student = studentDetailsMap.get(request.student_id);
        const template = templates.find(t => t.id === request.template_id);

        if (!student || !template) {
            showError("Missing student details or template.");
            return;
        }

        const html = getCertificateHtml(request, student, template);
        setPreviewHtml(html);
        setSelectedRequest(request);
        setIsPreviewOpen(true);
    };

    const handleDownload = async (request: BonafideRequest) => {
        const student = studentDetailsMap.get(request.student_id);
        const template = templates.find(t => t.id === request.template_id);

        if (!student || !template) {
            showError("Missing student details or template.");
            return;
        }

        const html = getCertificateHtml(request, student, template);
        await generatePdf(html, `Certificate-${request.certificate_number || student.register_number}.pdf`);
    };

    const handlePrint = () => {
        if (previewHtml) {
            printHtml(previewHtml);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading Issued Certificates...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">Issued Certificates</h1>
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
                            <Label>Filter by Issue Date</Label>
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
                                <TableHead>Certificate No</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Register Number</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead onClick={toggleSort} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        Issue Date <ArrowUpDown className="h-4 w-4" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedRequests.length > 0 ? (
                                filteredAndSortedRequests.map((request) => {
                                    const student = studentDetailsMap.get(request.student_id);
                                    return (
                                        <TableRow key={request.id}>
                                            <TableCell className="font-mono font-medium text-blue-600 dark:text-blue-400">
                                                {request.certificate_number || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                {student ? `${student.first_name} ${student.last_name || ''}`.trim() : "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                {student?.register_number || "N/A"}
                                            </TableCell>
                                            <TableCell>{student?.department_name || "N/A"}</TableCell>
                                            <TableCell>{formatDateToIndian(request.issued_at || request.created_at || request.date)}</TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handlePreview(request)} className="gap-2">
                                                    <Eye className="h-4 w-4" /> Preview
                                                </Button>
                                                <Button size="sm" onClick={() => handleDownload(request)} className="gap-2">
                                                    <Download className="h-4 w-4" /> Download
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                        No issued certificates found matching the current filters.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isPreviewOpen} onOpenChange={(open) => {
                setIsPreviewOpen(open);
                if (!open) setSelectedRequest(null);
            }}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Certificate Preview</DialogTitle>
                        <DialogDescription>
                            Previously issued certificate.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-4 border rounded bg-white">
                        <div
                            className="bg-white text-black min-h-[400px] p-8"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
                        <Button variant="secondary" onClick={handlePrint} className="gap-2">
                            <Printer className="h-4 w-4" /> Print
                        </Button>
                        <Button onClick={() => selectedRequest && handleDownload(selectedRequest)} className="gap-2">
                            <Download className="h-4 w-4" /> Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default IssuedCertificates;
