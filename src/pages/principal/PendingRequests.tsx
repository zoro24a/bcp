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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchStudentDetails, fetchTemplates, updateRequestStatus } from "@/data/appData";
import { BonafideRequest, StudentDetails, CertificateTemplate } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
import { generatePdf, getCertificateHtml } from "@/lib/pdf";
import { formatDateToIndian } from "@/lib/utils";
import RequestDetailsView from "@/components/shared/RequestDetailsView";
import { useSession } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

const PrincipalPendingRequests = () => {
  const { user } = useSession();
  const [requests, setRequests] = useState<BonafideRequest[]>([]);
  const [studentDetailsMap, setStudentDetailsMap] = useState<Map<string, StudentDetails>>(new Map());
  const [selectedRequest, setSelectedRequest] =
    useState<BonafideRequest | null>(null);
  const [previewStudentDetails, setPreviewStudentDetails] = useState<StudentDetails | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [addSignature, setAddSignature] = useState(true);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPrincipalRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'Pending Principal Approval');

      if (error) {
        showError("Error fetching pending requests: " + error.message);
        setRequests([]);
      } else {
        setRequests(data as BonafideRequest[]);
        
        // Fetch details for all students involved in these requests
        const uniqueStudentIds = Array.from(new Set(data.map(r => r.student_id)));
        const detailsPromises = uniqueStudentIds.map(id => fetchStudentDetails(id));
        const detailsResults = await Promise.all(detailsPromises);
        
        const newMap = new Map<string, StudentDetails>();
        detailsResults.forEach(detail => {
            if (detail) {
                newMap.set(detail.id, detail);
            }
        });
        setStudentDetailsMap(newMap);
      }

      const fetchedTemplates = await fetchTemplates();
      setTemplates(fetchedTemplates);
    } catch (err) {
      console.error("PrincipalPendingRequests fetch error:", err);
      showError("Failed to load requests and student details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrincipalRequests();
  }, [user]);

  const handleApproveAndDownload = async () => {
    if (!selectedRequest) {
      showError("No request selected for approval.");
      return;
    }

    const student = previewStudentDetails; // Use the details already verified in preview
    
    if (!selectedRequest.template_id) {
      showError("Error: No certificate template was assigned to this request. Please return it to the HOD/Tutor.");
      return;
    }

    const template: CertificateTemplate | undefined = templates.find(
      (t) => t.id === selectedRequest.template_id
    );

    if (!student) {
      showError("Error: Failed to retrieve student details (Department/Batch info) for this request.");
      return;
    }

    if (!template) {
      showError(`Error: The assigned certificate template (ID: ${selectedRequest.template_id}) could not be found.`);
      return;
    }

    // Add logging here to confirm template content and student details
    console.log("[PrincipalPendingRequests] Approving request:", selectedRequest.id);
    console.log("[PrincipalPendingRequests] Student details for PDF:", student);
    console.log("[PrincipalPendingRequests] Template for PDF:", template);
    console.log("[PrincipalPendingRequests] Template content for PDF:", template.content);


    try {
      // Since template_type is now strictly "html", we can simplify this.
      const htmlContent = getCertificateHtml(
        selectedRequest,
        student,
        template,
        addSignature
      );
      console.log("[PrincipalPendingRequests] Final HTML content for PDF generation:", htmlContent); // Debugging
      const fileName = `Bonafide-${student.register_number}.pdf`;
      await generatePdf(htmlContent, fileName);

      const updated = await updateRequestStatus(selectedRequest.id, "Approved");
      if (updated) {
        showSuccess(`Request approved and document downloaded.`);
        fetchPrincipalRequests();
        setIsApproveOpen(false);
        setSelectedRequest(null);
        setPreviewStudentDetails(null);
        setAddSignature(true);
      } else {
        showError("The certificate was downloaded, but the request status could not be updated in the database.");
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      showError("An error occurred while generating the certificate: " + err.message);
    }
  };

  const handleReturn = async () => {
    if (!selectedRequest || !returnReason) return;
    const updated = await updateRequestStatus(selectedRequest.id, "Returned by Principal", returnReason);
    if (updated) {
      showSuccess(`Request returned to HOD.`);
      fetchPrincipalRequests();
      setIsReturnOpen(false);
      setReturnReason("");
      setSelectedRequest(null);
      setPreviewStudentDetails(null);
    } else {
      showError("Failed to return request.");
    }
  };

  const openReviewDialog = (request: BonafideRequest) => {
    setSelectedRequest(request);
    const details = studentDetailsMap.get(request.student_id) || null;
    setPreviewStudentDetails(details);
    setIsReviewOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Requests...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we fetch pending requests.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg No.</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date</TableHead>
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
                      <TableCell>{formatDateToIndian(request.date)}</TableCell>
                      <TableCell>{request.type}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => openReviewDialog(request)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No pending requests.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isReviewOpen} onOpenChange={(open) => {
        setIsReviewOpen(open);
        if (!open) {
          setSelectedRequest(null);
          setPreviewStudentDetails(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription>
              Review the details of the student's request before taking action.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && <RequestDetailsView request={selectedRequest} student={previewStudentDetails} />}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsReviewOpen(false);
                setIsReturnOpen(true);
              }}
            >
              Return to HOD
            </Button>
            <Button
              onClick={() => {
                setIsReviewOpen(false);
                setIsApproveOpen(true);
              }}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isApproveOpen} onOpenChange={(open) => {
        setIsApproveOpen(open);
        if (!open) {
          setSelectedRequest(null);
          setPreviewStudentDetails(null);
          setAddSignature(true);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0"> {/* Added max-h and flex-col */}
          <DialogHeader className="p-6 pb-2"> {/* Added padding */}
            <DialogTitle>Approve Certificate</DialogTitle>
            <DialogDescription>
              Review the certificate content and choose whether to add an e-signature before approving and downloading.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6 pt-2"> {/* Wrapped content in ScrollArea */}
            {selectedRequest && (
              <div className="py-4">
                <h3 className="font-semibold mb-2">Certificate Preview</h3>
                {selectedRequest.template_id && previewStudentDetails ? (
                  (() => {
                    const template = templates.find((t) => t.id === selectedRequest.template_id);
                    if (!template) {
                      return <p className="text-destructive">Error: Assigned template not found.</p>;
                    }
                    if (template.template_type === "html") {
                      const htmlContent = getCertificateHtml(
                        selectedRequest,
                        previewStudentDetails,
                        template,
                        addSignature
                      );
                      console.log("[PrincipalPendingRequests] Preview HTML content:", htmlContent); // Debugging
                      return (
                        <>
                          <div
                            className="p-4 border rounded-md bg-muted prose dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                          />
                          <div className="flex items-center space-x-2 mt-4">
                            <Checkbox
                              id="e-sign"
                              checked={addSignature}
                              onCheckedChange={(checked) =>
                                setAddSignature(checked as boolean)
                              }
                            />
                            <Label htmlFor="e-sign">Add E-Signature</Label>
                          </div>
                        </>
                      );
                    } else {
                      // This branch should ideally not be hit if template_type is strictly "html"
                      return (
                        <p className="text-muted-foreground">
                          This is a file-based template ({template.template_type?.toUpperCase()}). It will be downloaded directly.
                        </p>
                      );
                    }
                  })()
                ) : (
                  <p className="text-destructive">
                    Error: Missing template ID or student details for preview.
                  </p>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="p-6 border-t bg-muted/20"> {/* Added padding and background */}
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleApproveAndDownload}>
              Approve and Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReturnOpen} onOpenChange={(open) => {
        setIsReturnOpen(open);
        if (!open) {
          setSelectedRequest(null);
          setPreviewStudentDetails(null);
          setReturnReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Return</DialogTitle>
            <DialogDescription>
              Provide a clear reason for returning this request to the HOD.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="return-reason">
              Please provide a reason for returning this request to the HOD.
            </Label>
            <Textarea
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleReturn} disabled={!returnReason}>
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PrincipalPendingRequests;