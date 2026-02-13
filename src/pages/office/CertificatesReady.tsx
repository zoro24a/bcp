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
    DialogClose,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchStudentDetails, fetchTemplates, updateRequestStatus, fetchRequests } from "@/data/appData";
import { BonafideRequest, StudentDetails, CertificateTemplate } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
import { getCertificateHtml, generatePdf } from "@/lib/pdf";
import { formatDateToIndian } from "@/lib/utils";
import { useSession } from "@/components/auth/SessionContextProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, CheckCircle, RotateCcw } from "lucide-react";

const CertificatesReady = () => {
    const { user } = useSession();
    const [requests, setRequests] = useState<BonafideRequest[]>([]);
    const [studentDetailsMap, setStudentDetailsMap] = useState<Map<string, StudentDetails>>(new Map());
    const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedRequest, setSelectedRequest] = useState<BonafideRequest | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string>("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [returnReason, setReturnReason] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const allRequests = await fetchRequests();
            const pendingIssue = allRequests.filter(r => r.status === "Approved by Principal");
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

    const handleIssue = async () => {
        if (!selectedRequest) return;

        // Optional: Generate PDF for download/printing by Office staff here if needed
        // For now, just update status

        const updated = await updateRequestStatus(selectedRequest.id, "Issued");
        if (updated) {
            showSuccess("Certificate marked as Issued.");
            fetchData();
            setIsPreviewOpen(false);
            setSelectedRequest(null);
        } else {
            showError("Failed to update status.");
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
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Certificates Ready for Issue</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Reg No.</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Type</TableHead>
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
                                                {student?.register_number || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                {student ? `${student.first_name} ${student.last_name || ''}`.trim() : "N/A"}
                                            </TableCell>
                                            <TableCell>{student?.department_name || "N/A"}</TableCell>
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
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        No certificates ready for issue.
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
                        <Button variant="destructive" onClick={() => { setIsPreviewOpen(false); setIsReturnOpen(true); }}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Return
                        </Button>
                        <Button onClick={handleIssue}>
                            <CheckCircle className="h-4 w-4 mr-2" /> Issue Certificate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
                <DialogContent>
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
        </>
    );
};

export default CertificatesReady;
