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
import { updateRequestStatus, fetchStudentDetails } from "@/data/appData";
import { BonafideRequest, StudentDetails } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
import { formatDateToIndian } from "@/lib/utils";
import RequestDetailsView from "@/components/shared/RequestDetailsView";
import { useSession } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

const HodPendingRequests = () => {
  const { user, profile } = useSession();
  const [requests, setRequests] = useState<BonafideRequest[]>([]);
  const [studentDetailsMap, setStudentDetailsMap] = useState<Map<string, StudentDetails>>(new Map());
  const [selectedRequest, setSelectedRequest] =
    useState<BonafideRequest | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchHodRequests = async () => {
    if (user?.id && profile?.department_id) {
      setLoading(true);
      try {
        // Fetch requests pending HOD approval (RLS handles filtering by department)
        const { data: requestsData, error: requestsError } = await supabase
          .from('requests')
          .select(`
            *,
            tutor:profiles!requests_tutor_id_fkey(first_name, last_name, name),
            hod:profiles!requests_hod_id_fkey(first_name, last_name, name)
          `)
          .in('status', ['Pending HOD Approval', 'Returned to HOD']);

        if (requestsError) {
          showError("Error fetching pending requests: " + requestsError.message);
          setRequests([]);
        } else {
          setRequests(requestsData as BonafideRequest[]);

          // Fetch details for all students involved in these requests
          const uniqueStudentIds = Array.from(new Set(requestsData.map(r => r.student_id)));
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
      } catch (error) {
        console.error("HodPendingRequests fetch error:", error);
        showError("Failed to load requests due to a data error.");
        setRequests([]);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchHodRequests();
  }, [user, profile?.department_id]);

  const handleForward = async () => {
    if (!selectedRequest) return;
    const updated = await updateRequestStatus(selectedRequest.id, "Pending Principal Approval");
    if (updated) {
      showSuccess(`Request ${selectedRequest.id} forwarded to Principal.`);
      fetchHodRequests(); // Refresh list
      setIsReviewOpen(false);
      setSelectedRequest(null);
    } else {
      showError("Failed to forward request.");
    }
  };

  const handleReturn = async () => {
    if (!selectedRequest || !returnReason) return;
    // Updated to save to hod_return_reason to ensure it's not overwritten
    const { updateRequest } = await import("@/data/appData");
    const updated = await updateRequest(selectedRequest.id, {
      status: "Returned to Tutor",
      hod_return_reason: returnReason,
      return_reason: returnReason
    });
    if (updated) {
      showSuccess(`Request ${selectedRequest.id} returned to tutor.`);
      fetchHodRequests(); // Refresh list
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
                <TableHead>Batch</TableHead>
                <TableHead>Sem</TableHead>
                <TableHead>Tutor</TableHead>
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
                      <TableCell>{student?.batch_name || "N/A"}</TableCell>
                      <TableCell>{student?.current_semester || "N/A"}</TableCell>
                      <TableCell>
                        {request.tutor?.first_name
                          ? `${request.tutor.first_name} ${request.tutor.last_name || ''}`.trim()
                          : request.tutor?.name || student?.tutor_name || "N/A"}
                      </TableCell>
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
                  <TableCell colSpan={8} className="text-center">
                    No pending requests.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription>
              Review the details of the student's request before taking action.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && <RequestDetailsView request={selectedRequest} student={studentForReview} />}
          {selectedRequest && (
            <DialogFooter>
              {(selectedRequest.status === "Pending HOD Approval" ||
                selectedRequest.status === "Returned to HOD") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsReviewOpen(false);
                      setIsReturnOpen(true);
                    }}
                  >
                    Return to Tutor
                  </Button>
                )}
              {selectedRequest.status === "Pending HOD Approval" && (
                <Button onClick={handleForward}>
                  Forward to Principal
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reason for Return (to Tutor)</DialogTitle>
            <DialogDescription>
              Provide a clear reason for returning this request to the Tutor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="return-reason">
              Please provide a reason for returning this request to the Tutor.
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

export default HodPendingRequests;