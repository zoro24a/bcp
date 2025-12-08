import React from "react";
import { ListOrdered, FileText, Users, CheckCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface BulkUploadWorkflowProps {
  onDownloadTemplate: () => void;
}

const BulkUploadWorkflow = ({ onDownloadTemplate }: BulkUploadWorkflowProps) => {
  const steps = [
    {
      icon: <Download className="h-5 w-5 text-primary" />,
      title: "Step 1: Download the Template",
      description: "Click the 'Download Template' button to get the required XLSX file structure. Do not change the header row names.",
    },
    {
      icon: <FileText className="h-5 w-5 text-primary" />,
      title: "Step 2: Fill in Student Data",
      description: (
        <>
          <p>Populate the rows with student details. Ensure the following fields are **mandatory**:</p>
          <ul className="list-disc list-inside ml-4 text-sm mt-1">
            <li>`first_name`, `email`, `register_number`, `department_name`, `batch_name`, and `password`.</li>
            <li>For `tutor_name` and `hod_name`, enter the full name (e.g., "John Smith"). The system will look up their IDs. Leave blank if unassigned.</li>
          </ul>
        </>
      ),
    },
    {
      icon: <Users className="h-5 w-5 text-primary" />,
      title: "Step 3: Ensure Staff/Departments Exist",
      description: "Verify that all specified `department_name`, `tutor_name`, and `hod_name` entries already exist in the system before uploading.",
    },
    {
      icon: <Upload className="h-5 w-5 text-primary" />,
      title: "Step 4: Upload and Process",
      description: "Select the completed XLSX file and click 'Upload and Process'. The system will validate the data, create new batches if necessary, and register the students.",
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-primary" />,
      title: "Step 5: Review Results",
      description: "Check the success message and the console for any reported errors or students that failed to upload.",
    },
  ];

  return (
    <div className="space-y-6">
      <CardTitle className="text-2xl">Bulk Upload Workflow</CardTitle>
      <Separator />
      
      <div className="space-y-6">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start space-x-4">
            <div className="flex-shrink-0 mt-1">
              {step.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <div className="text-muted-foreground text-sm mt-1">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="pt-4">
        <Button onClick={onDownloadTemplate} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Download Student Template
        </Button>
      </div>
    </div>
  );
};

export default BulkUploadWorkflow;