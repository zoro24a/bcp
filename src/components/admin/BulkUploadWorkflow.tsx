import React from "react";
import { Download } from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface BulkUploadWorkflowProps {
  onDownloadTemplate: () => void;
}

const BulkUploadWorkflow = ({ onDownloadTemplate }: BulkUploadWorkflowProps) => {
  return (
    <div className="space-y-6">
      <CardTitle className="text-2xl">Bulk Upload Workflow</CardTitle>
      <Separator />
      
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