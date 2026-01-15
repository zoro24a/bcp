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
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CertificateTemplate } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
// Removed RichTextEditor import
import { createTemplate, deleteTemplate, fetchTemplates, updateTemplate } from "@/data/appData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea

const TemplateManagement = () => {
  const [templates, setTemplates] =
    useState<CertificateTemplate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [currentTemplate, setCurrentTemplate] = useState<
    Partial<CertificateTemplate>
  >({ template_type: "html", content: "" }); // Default to HTML
  const [loading, setLoading] = useState(true);

  const fetchTemplatesData = async () => {
    setLoading(true);
    const fetchedTemplates = await fetchTemplates();
    setTemplates(fetchedTemplates);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplatesData();
  }, []);

  const handleOpenDialog = (
    mode: "create" | "edit",
    template?: CertificateTemplate
  ) => {
    setDialogMode(mode);
    let initialTemplate: Partial<CertificateTemplate>;

    if (mode === "create") {
      initialTemplate = { name: "", template_type: "html", content: "" }; // Always HTML
    } else {
      initialTemplate = { ...template! };
      // No unescaping needed here, as content will be stored as raw HTML
      if (initialTemplate.template_type === "html" && (initialTemplate.content === undefined || initialTemplate.content === null)) {
        initialTemplate.content = "";
      }
    }
    setCurrentTemplate(initialTemplate);
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!currentTemplate.name) {
      showError("Template name is required.");
      return;
    }

    // Template type is always 'html' now
    const contentToSave = currentTemplate.content || "";

    if (!contentToSave) {
      showError("HTML content is required for templates.");
      return;
    }

    if (dialogMode === "create") {
      const newTemplatePayload: Omit<CertificateTemplate, 'id' | 'created_at' | 'file_url'> = {
        name: currentTemplate.name,
        content: contentToSave,
        template_type: "html", // Always HTML
      };
      const created = await createTemplate(newTemplatePayload);
      if (created) {
        showSuccess(`Template "${created.name}" created successfully.`);
        fetchTemplatesData();
      } else {
        showError("Failed to create template.");
      }
    } else {
      if (!currentTemplate.id) {
        showError("Template ID is missing for update.");
        return;
      }
      const updated = await updateTemplate(currentTemplate.id, {
        name: currentTemplate.name,
        content: contentToSave,
        template_type: "html", // Always HTML
      });
      if (updated) {
        showSuccess(`Template "${updated.name}" updated successfully.`);
        fetchTemplatesData();
      } else {
        showError("Failed to update template.");
      }
    }
    setIsDialogOpen(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const templateName = templates.find((t) => t.id === templateId)?.name;
    const deleted = await deleteTemplate(templateId);
    if (deleted) {
      showSuccess(`Template "${templateName}" deleted successfully.`);
      fetchTemplatesData();
    } else {
      showError("Failed to delete template.");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Templates...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we fetch template data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Template Management</CardTitle>
        <Button onClick={() => handleOpenDialog("create")}>
          Add New Template
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Master Template Tip</AlertTitle>
          <AlertDescription>
            You can maintain a single Master Template using dynamic placeholders like <strong>{`{purpose}`}</strong>. The student's chosen purpose (e.g., Scholarship, Passport) will be injected automatically at runtime.
          </AlertDescription>
        </Alert>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length > 0 ? (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{template.template_type?.toUpperCase() || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => handleOpenDialog("edit", template)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  No templates found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>
              {dialogMode === "create" ? "Create New" : "Edit"} Template
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create" ? "Define a new certificate template using raw HTML content." : "Modify an existing certificate template using raw HTML content."}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6 pt-2">
            <div className="grid gap-6 pr-4">
              <div className="grid gap-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={currentTemplate.name || ""}
                  onChange={(e) =>
                    setCurrentTemplate({
                      ...currentTemplate,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g., Standard Bonafide"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-content">HTML Content</Label>
                <Textarea
                  id="template-content"
                  value={currentTemplate.content || ""}
                  onChange={(e) =>
                    setCurrentTemplate({ ...currentTemplate, content: e.target.value })
                  }
                  placeholder={`<div style="font-family:'Times New Roman', serif;">...</div>`}
                  rows={15}
                  className="font-mono text-sm"
                />
                <div className="mt-4 p-4 bg-muted rounded-md space-y-2">
                  <p className="text-sm font-semibold">Available Dynamic Placeholders:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                    <div>{`{studentName}`}</div>
                    <div>{`{studentId}`}</div>
                    <div>{`{purpose}`}</div>
                    <div>{`{subPurpose}`}</div>
                    <div>{`{parentName}`}</div>
                    <div>{`{department}`}</div>
                    <div>{`{batch}`}</div>
                    <div>{`{currentSemester}`}</div>
                    <div>{`{date}`}</div>
                    <div>{`{detailedReason}`}</div>
                    <div>{`{salutation}`} (Mr./Ms.)</div>
                    <div>{`{heShe}`}</div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t bg-muted/20">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TemplateManagement;