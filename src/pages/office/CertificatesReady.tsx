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
    DialogClose,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { fetchStudentDetails, fetchTemplates, updateRequestStatus, fetchRequests, issueCertificate, fetchDepartments } from "@/data/appData";
import { BonafideRequest, StudentDetails, CertificateTemplate, Department } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
import { getCertificateHtml, generatePdf } from "@/lib/pdf";
import { formatDateToIndian } from "@/lib/utils";
import { useSession } from "@/components/auth/SessionContextProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, CheckCircle, RotateCcw, ArrowUpDown, Filter } from "lucide-react";

const CertificatesReady = () => {
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
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [returnReason, setReturnReason] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pendingIssue, fetchedDepts, fetchedTemplates] = await Promise.all([
                fetchRequests("Ready for Issue"),
                fetchDepartments(),
                fetchTemplates()
            ]);

            setRequests(pendingIssue);
            setDepartments(fetchedDepts);
            setTemplates(fetchedTemplates);

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

        // 3. Sort by Approval Date
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

    const handleIssue = async () => {
        if (!selectedRequest) return;

        const updated = await issueCertificate(selectedRequest.id);

        if (updated) {
            if (updated.certificate_number) {
                showSuccess(`Certificate Issued: ${updated.certificate_number}`);
            } else {
                showError("Certificate Issued but Serial Number is MISSING in response. Check database.");
            }

            // Refresh preview with the newly generated certificate number
            const student = studentDetailsMap.get(updated.student_id);
            const template = templates.find(t => t.id === updated.template_id);

            if (student && template) {
                // IMPORTANT: Ensure we use the 'updated' row which contains the actual certificate_number
                const html = getCertificateHtml(updated, student, template);
                setPreviewHtml(html);
                setSelectedRequest(updated);
            }

            // Remove the issued request from the local list
            setRequests(prev => prev.filter(r => r.id !== updated.id));
        }
    };

    const handlePrint = async () => {
        if (!selectedRequest || !previewHtml) return;
        const student = studentDetailsMap.get(selectedRequest.student_id);
        if (student) {
            await generatePdf(previewHtml, `Certificate-${student.register_number}.pdf`);
        }
    };


    const handleReturn = async () => {
        if (!selectedRequest || !returnReason) return;
        const updated = await updateRequestStatus(selectedRequest.id, "Returned by Office", returnReason);
        if (updated) {
            showSuccess("Request returned to Principal.");
            fetchData();
            setIsReturnOpen(false);
            setReturnReason("");
            setSelectedRequest(null);
        } else {
            showError("Failed to return request.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading Certificates...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">Certificates Ready for Issue</h1>
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
                                <TableHead>Reg No.</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead onClick={toggleSort} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        Approved Date <ArrowUpDown className="h-4 w-4" />
                                    </div>
                                </TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedRequests.length > 0 ? (
                                filteredAndSortedRequests.map((request) => {
                                    const student = studentDetailsMap.get(request.student_id);
                                    return (
                                        <TableRow key={request.id}>
                                            <TableCell className="font-medium">
                                                {student?.register_number || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                {student ? `${student.first_name} ${student.last_name || ''}`.trim() : "N/A"}
                                            </TableCell>
                                            <TableCell>{student?.department_name || "N/A"}</TableCell>
                                            <TableCell>{formatDateToIndian(request.created_at || request.date)}</TableCell>
                                            <TableCell>{request.type}</TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handlePreview(request)}>
                                                    <Eye className="h-4 w-4 mr-1" /> Preview
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                        No certificates found matching the current filters.
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
                        <DialogDescription>Review the certificate before issuing to the student.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-4 border rounded bg-muted">
                        <div
                            className="prose dark:prose-invert max-w-none bg-white text-black p-8 min-h-[400px]"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    </ScrollArea>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <div className="flex-1 flex justify-start">
                            <Button variant="secondary" onClick={handlePrint}>Download PDF</Button>
                        </div>
                        {selectedRequest?.status !== "Issued" && (
                            <>
                                <Button variant="destructive" onClick={() => { setIsPreviewOpen(false); setIsReturnOpen(true); }}>
                                    <RotateCcw className="h-4 w-4 mr-2" /> Return
                                </Button>
                                <Button onClick={handleIssue}>
                                    <CheckCircle className="h-4 w-4 mr-2" /> Issue Certificate
                                </Button>
                            </>
                        )}
                        {selectedRequest?.status === "Issued" && (
                            <DialogClose asChild>
                                <Button variant="outline">Done</Button>
                            </DialogClose>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Return Request</DialogTitle>
                        <DialogDescription>Reason for returning to Principal.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="Enter reason..."
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleReturn} disabled={!returnReason}>
                            Confirm Return
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CertificatesReady;
