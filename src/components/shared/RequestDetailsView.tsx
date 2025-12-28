import { BonafideRequest, StudentDetails } from "@/lib/types";
import { formatDateToIndian } from "@/lib/utils";
import ProfileField from "./ProfileField";
import { useEffect, useState } from "react";
// Removed import { fetchStudentDetails } from "@/data/appData";

interface RequestDetailsViewProps {
  request: BonafideRequest;
  student: StudentDetails | null; // Now required as a prop
}

const RequestDetailsView = ({ request, student }: RequestDetailsViewProps) => {
  // Removed internal state and useEffect for fetching student details

  if (!student) {
    return <div>Student details unavailable.</div>;
  }

  return (
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
      <ProfileField label="HOD">{student.hod_name || "N/A"}</ProfileField>
      
      <ProfileField label="Request Type">{request.type}</ProfileField>
      {request.sub_type && (
        <ProfileField label="Sub-type">{request.sub_type}</ProfileField>
      )}
      <div className="md:col-span-2">
        <ProfileField label="Reason">{request.reason}</ProfileField>
      </div>
    </div>
  );
};

export default RequestDetailsView;