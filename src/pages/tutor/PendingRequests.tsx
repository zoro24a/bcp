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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchTemplates, updateRequestStatus, fetchStudentDetails } from "@/data/appData";
import { formatDateToIndian } from "@/lib/utils";
import { BonafideRequest, CertificateTemplate, StudentDetails } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
import RequestDetailsView from "@/components/shared/RequestDetailsView";
import { useSession } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

const TutorPendingRequests = () => {
  const { user } = useSession();
  const [requests, setRequests] = useState<BonafideRequest[]>([]);
  const [studentDetailsMap, setStudentDetailsMap] = useState<Map<string, StudentDetails>>(new Map());
  const [selectedRequest, setSelectedRequest] =
    useState<BonafideRequest | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTutorRequests = async () => {
    if (user?.id) {
      setLoading(true);
      try {
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('id')
          .eq('tutor_id', user.id);

        if (studentsError) {
          showError("Error fetching assigned students: " + studentsError.message);
          setRequests([]);
          setLoading(false);
          return;
        }

        const tutorStudentsIds = studentsData?.map(s => s.id) || [];
        if (tutorStudentsIds.length === 0) {
          setRequests([]);
          setLoading(false);
          return;
        }

        const { data: requestsData, error: requestsError } = await supabase
          .from('requests')
          .select(`
            *,
            tutor:profiles!requests_tutor_id_fkey(name),
            hod:profiles!requests_hod_id_fkey(name)
          `)
          .in('status', ['Pending Tutor Approval', 'Returned to Tutor'])
          .in('student_id', tutorStudentsIds);

        if (requestsError) {
          showError("Error fetching pending requests: " + requestsError.message);
          setRequests([]);
        } else {
          setRequests(requestsData as BonafideRequest[]);

          // Fetch details for all students involved in these requests using Promise.allSettled
          const uniqueStudentIds = Array.from(new Set(requestsData.map(r => r.student_id)));
          const detailsPromises = uniqueStudentIds.map(id => fetchStudentDetails(id));

          // Use Promise.allSettled to ensure all promises complete, regardless of individual success/failure
          const detailsResults = await Promise.allSettled(detailsPromises);

          const newMap = new Map<string, StudentDetails>();
          detailsResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
              newMap.set(result.value.id, result.value);
            } else if (result.status === 'rejected') {
              console.error("Failed to fetch student detail:", result.reason);
              // Optionally show a toast error here, but we proceed with available data
            }
          });
          setStudentDetailsMap(newMap);
        }

        const fetchedTemplates = await fetchTemplates();
        // Filter templates to only show HTML type
        setTemplates(fetchedTemplates.filter(t => t.template_type === "html"));
      } catch (error) {
        console.error("TutorPendingRequests fetch error:", error);
        showError("Failed to load requests due to a data error.");
        setRequests([]);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchTutorRequests();
  }, [user]);

  const handleForward = async () => {
    if (!selectedRequest || !selectedTemplate) return;

    const { fetchHodByDepartment, fetchStudentDetails, updateRequest } = await import("@/data/appData");
    let hodId = undefined;

    // Get student details to find department
    const student = await fetchStudentDetails(selectedRequest.student_id);
    if (student?.department_id) {
      const hod = await fetchHodByDepartment(student.department_id);
      hodId = hod?.id;
    }

    const updated = await updateRequest(selectedRequest.id, {
      status: "Pending HOD Approval",
      template_id: selectedTemplate,
      hod_id: hodId
    });

    if (updated) {
      showSuccess(`Request ${selectedRequest.id} forwarded to HOD.`);
      fetchTutorRequests(); // Refresh list
      setIsForwardOpen(false);
      setSelectedRequest(null);
      setSelectedTemplate("");
    } else {
      showError("Failed to forward request.");
    }
  };

  const handleReturn = async () => {
    if (!selectedRequest || !returnReason) return;
    // Updated to save to tutor_return_reason to ensure it's not overwritten
    const { updateRequest } = await import("@/data/appData");
    const updated = await updateRequest(selectedRequest.id, {
      status: "Returned to Student",
      tutor_return_reason: returnReason,
      return_reason: returnReason
    });
    if (updated) {
      showSuccess(`Request ${selectedRequest.id} returned to student.`);
      fetchTutorRequests(); // Refresh list
      setIsReturnOpen(false);
      setIsReviewOpen(false);
      setReturnReason("");
      setSelectedRequest(null);
    } else {
      showError("Failed to return request.");
    }
  };

  const openReviewDialog = (request: BonafideRequest) => {
    setSelectedRequest(request);
    setIsReviewOpen(true);
  };

  const studentForReview = selectedRequest ? studentDetailsMap.get(selectedRequest.student_id) : null;

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
                <TableHead>Sem</TableHead>
                <TableHead>HOD</TableHead>
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
                      <TableCell>{student?.current_semester || "N/A"}</TableCell>
                      <TableCell>{request.hod?.name || "N/A"}</TableCell>
                      <TableCell>{formatDateToIndian(request.created_at || request.date)}</TableCell>
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

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription>
              Review the details of the student's request before taking action.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && <RequestDetailsView request={selectedRequest} student={studentForReview} />}
          {selectedRequest && (
            <DialogFooter>
              {(selectedRequest.status === "Pending Tutor Approval" ||
                selectedRequest.status === "Returned to Tutor") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsReviewOpen(false);
                      setIsReturnOpen(true);
                    }}
                  >
                    Return to Student
                  </Button>
                )}
              {selectedRequest.status === "Pending Tutor Approval" && (
                <Button
                  onClick={() => {
                    setIsReviewOpen(false);
                    setIsForwardOpen(true);
                  }}
                >
                  Forward to HOD
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isForwardOpen} onOpenChange={setIsForwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Certificate Template</DialogTitle>
            <DialogDescription>
              Choose the appropriate certificate template for this request.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="template-select">Template</Label>
            <Select onValueChange={setSelectedTemplate}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleForward} disabled={!selectedTemplate}>
              Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Return</DialogTitle>
            <DialogDescription>
              Provide a clear reason for returning this request to the student.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="return-reason">
              Please provide a reason for returning this request.
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

export default TutorPendingRequests;