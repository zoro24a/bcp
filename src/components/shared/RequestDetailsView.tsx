import { BonafideRequest, StudentDetails } from "@/lib/types";
import { formatDateToIndian } from "@/lib/utils";
import ProfileField from "./ProfileField";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface RequestDetailsViewProps {
  request: BonafideRequest;
  student: StudentDetails | null; // Now required as a prop
}

const RequestDetailsView = ({ request, student }: RequestDetailsViewProps) => {
  if (!student) {
    return <div>Student details unavailable.</div>;
  }

  const hasHistory = request.tutor_return_reason || request.hod_return_reason || request.principal_return_reason;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <ProfileField label="Request ID">{request.id}</ProfileField>
        <ProfileField label="Date Submitted">
          {formatDateToIndian(request.date)}
        </ProfileField>
        <ProfileField label="Student Name">
          {`${student.first_name} ${student.last_name || ''}`.trim()}
        </ProfileField>
        <ProfileField label="Register Number">{student.register_number || "N/A"}</ProfileField>

        {/* Student details are now guaranteed to be present if we reach here */}
        <ProfileField label="Department">{student.department_name || "N/A"}</ProfileField>
        <ProfileField label="Batch">{student.batch_name || "N/A"}</ProfileField>
        <ProfileField label="Current Semester">
          {student.current_semester || "N/A"}
        </ProfileField>
        <ProfileField label="Tutor">{student.tutor_name || "N/A"}</ProfileField>
        <ProfileField label="HOD">
          {request.hod?.first_name
            ? `${request.hod.first_name} ${request.hod.last_name || ''}`.trim()
            : request.hod?.name || student.hod_name || "N/A"}
        </ProfileField>
        <ProfileField label="Specialization">{request.specialization_snapshot || student.specialization || "N/A"}</ProfileField>

        <ProfileField label="Request Type">{request.type}</ProfileField>
        {request.sub_type && (
          <ProfileField label="Sub-type">{request.sub_type}</ProfileField>
        )}
        {request.company_block && (
          <ProfileField label="Company / Organization">{request.company_block}</ProfileField>
        )}
        {request.duration_block && (
          <ProfileField label="Duration / Timeframe">{request.duration_block}</ProfileField>
        )}
        <div className="md:col-span-2">
          <ProfileField label="Reason">{request.reason}</ProfileField>
        </div>
      </div>

      {hasHistory && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold whitespace-nowrap text-muted-foreground uppercase tracking-wider text-sm">Review History</h3>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-3">
            {request.tutor_return_reason && (
              <div className="bg-yellow-500/5 p-4 rounded-lg border border-yellow-200/50 dark:border-yellow-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/30 dark:text-yellow-500 border-yellow-200 dark:border-yellow-800/30 shadow-none">
                    Tutor
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">Return Remark</span>
                </div>
                <p className="text-sm leading-relaxed">{request.tutor_return_reason}</p>
              </div>
            )}
            {request.hod_return_reason && (
              <div className="bg-orange-500/5 p-4 rounded-lg border border-orange-200/50 dark:border-orange-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100/80 dark:bg-orange-900/30 dark:text-orange-500 border-orange-200 dark:border-orange-800/30 shadow-none">
                    HOD
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">Return Remark</span>
                </div>
                <p className="text-sm leading-relaxed">{request.hod_return_reason}</p>
              </div>
            )}
            {request.principal_return_reason && (
              <div className="bg-red-500/5 p-4 rounded-lg border border-red-200/50 dark:border-red-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/30 dark:text-red-500 border-red-200 dark:border-red-800/30 shadow-none">
                    Principal
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">Return Remark</span>
                </div>
                <p className="text-sm leading-relaxed">{request.principal_return_reason}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetailsView;
