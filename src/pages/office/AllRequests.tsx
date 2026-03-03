import { useState, useEffect } from "react";
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
import { fetchStudentDetails, fetchTemplates, fetchRequests } from "@/data/appData";
import { BonafideRequest, StudentDetails, CertificateTemplate } from "@/lib/types";
import { showError } from "@/utils/toast";
import { getCertificateHtml, generatePdf } from "@/lib/pdf";
import { formatDateToIndian } from "@/lib/utils";
import { useSession } from "@/components/auth/SessionContextProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutDashboard, FileCheck, User, CheckCircle, Eye, Download } from "lucide-react";

const OfficeAllRequests = () => {
    const { user } = useSession();
    const [requests, setRequests] = useState<BonafideRequest[]>([]);
    const [studentDetailsMap, setStudentDetailsMap] = useState<Map<string, StudentDetails>>(new Map());
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedRequest, setSelectedRequest] = useState<BonafideRequest | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string>("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Requirement 1: Use database-level filtering
            const pendingIssue = await fetchRequests("Ready for Issue");
            setRequests(pendingIssue);

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

            const fetchedTemplates = await fetchTemplates();
            setTemplates(fetchedTemplates);
        } catch (err: any) {
            showError("Failed to load data: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

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

    const handleDownload = async () => {
        if (!selectedRequest || !previewHtml) return;
        const student = studentDetailsMap.get(selectedRequest.student_id);
        if (student) {
            await generatePdf(previewHtml, `Certificate-${student.register_number}.pdf`);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading Requests...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">All Requests (Ready for Issue)</h1>
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Requests for Collection</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Register Number</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Approved Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.length > 0 ? (
                                requests.map((request) => {
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
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => handlePreview(request)} className="gap-2">
                                                    <Eye className="h-4 w-4" /> Preview & Download
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                        No requests with status "Ready for Issue" found.
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
                <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Certificate Preview</DialogTitle>
                        <DialogDescription>
                            Review the details below. Only downloading is permitted on this page.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-4 border rounded bg-white p-8">
                        <div
                            className="bg-white text-black min-h-[400px]"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
                        <Button onClick={handleDownload} className="gap-2">
                            <Download className="h-4 w-4" /> Download Certificate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OfficeAllRequests;
