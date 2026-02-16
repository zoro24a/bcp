import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchRequests,
  fetchStudentDetails,
  fetchTemplates,
  updateRequest,
} from "@/data/appData";
import { BonafideRequest, StudentDetails, CertificateTemplate } from "@/lib/types";
import { getStatusVariant, formatDateToIndian } from "@/lib/utils";
import { generatePdf, getCertificateHtml } from "@/lib/pdf";
import { Download } from "lucide-react";
import { useSession } from "@/components/auth/SessionContextProvider";
import { useEffect, useState } from "react";
import { showError, showSuccess } from "@/utils/toast";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const MyRequests = () => {
  const { user } = useSession();
  const [studentRequests, setStudentRequests] = useState<BonafideRequest[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const getRequests = async () => {
    if (user?.id) {
      setLoading(true);
      const [allRequests, fetchedTemplates, details] = await Promise.all([
        fetchRequests(),
        fetchTemplates(),
        fetchStudentDetails(user.id)
      ]);

      const filtered = allRequests.filter((req) => req.student_id === user.id);

      // Sort requests by created_at or date in descending order (most recent first)
      const sortedRequests = [...filtered].sort((a, b) => {
        const dateA = new Date(a.created_at || a.date);
        const dateB = new Date(b.created_at || b.date);
        return dateB.getTime() - dateA.getTime();
      });

      setStudentRequests(sortedRequests);
      setTemplates(fetchedTemplates);
      setStudentDetails(details);
      setLoading(false);
    }
  };

  useEffect(() => {
    getRequests();
  }, [user]);

  const handleResubmit = async (request: BonafideRequest) => {
    const nextResubmissionCount = (request.resubmission_count || 0) + 1;
    const updated = await updateRequest(request.id, {
      status: "Pending Tutor Approval",
      resubmission_count: nextResubmissionCount,
      return_reason: null,
    });

    if (updated) {
      showSuccess("Request resubmitted successfully.");
      getRequests();
    } else {
      showError("Failed to resubmit request.");
    }
  };

  // handleDownload removed

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Requests...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we fetch your requests.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Sub-type</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentRequests.length > 0 ? (
              studentRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.type}</TableCell>
                  <TableCell>{request.sub_type || "N/A"}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {request.reason}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(request.status)}>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === "Pending Tutor Approval" && (
                      <EditRequestDialog
                        request={request}
                        onSuccess={getRequests}
                      />
                    )}
                    {request.status === "Issued" && (
                      <Badge variant="outline" className="border-green-500 text-green-600">
                        Ready for Collection
                      </Badge>
                    )}
                    {request.status === "Approved by Principal" && (
                      <span className="text-muted-foreground text-sm">Processing at Office</span>
                    )}
                    {request.status.startsWith("Returned") && (
                      <div className="flex flex-col items-end gap-2">
                        {request.status === "Returned to Student" && (
                          <div className="text-xs text-destructive font-medium mb-1 max-w-[200px] text-right">
                            Reason: {request.return_reason || "No reason provided."}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="secondary" size="sm">
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reason for Return</DialogTitle>
                                <DialogDescription>
                                  Your request was returned for the following reason.
                                  Please address the issue and resubmit if necessary.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <p className="text-sm font-medium bg-muted p-4 rounded-md">
                                  {request.return_reason || "No reason provided."}
                                </p>
                              </div>
                            </DialogContent>
                          </Dialog>
                          {request.status === "Returned to Student" && (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleResubmit(request)}
                            >
                              Resubmit
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

interface EditRequestDialogProps {
  request: BonafideRequest;
  onSuccess: () => void;
}

const EditRequestDialog = ({ request, onSuccess }: EditRequestDialogProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(request.type);
  const [subType, setSubType] = useState(request.sub_type || "");
  const [reason, setReason] = useState(request.reason);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!type || !reason) {
      showError("Type and Reason are required.");
      return;
    }

    setSaving(true);
    const updated = await updateRequest(request.id, {
      type,
      sub_type: subType,
      reason,
    });

    if (updated) {
      showSuccess("Request updated successfully.");
      setOpen(false);
      onSuccess();
    } else {
      showError("Failed to update request.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Request</DialogTitle>
          <DialogDescription>
            Modify your request details below. You can only edit while it's pending tutor approval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="edit-type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Passport Application">Passport Application</SelectItem>
                <SelectItem value="Bank Loan">Bank Loan</SelectItem>
                <SelectItem value="Scholarship">Scholarship</SelectItem>
                <SelectItem value="Internship Application">Internship Application</SelectItem>
                <SelectItem value="Visa Application">Visa Application</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-sub-type">Sub-type (Optional)</Label>
            <Input
              id="edit-sub-type"
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-reason">Reason</Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyRequests;