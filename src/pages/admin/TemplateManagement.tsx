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
import { MoreHorizontal, Info, Upload, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CertificateTemplate } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";
import { createTemplate, deleteTemplate, fetchTemplates, updateTemplate, uploadAsset } from "@/data/appData";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

const TemplateManagement = () => {
  const [templates, setTemplates] =
    useState<CertificateTemplate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [currentTemplate, setCurrentTemplate] = useState<
    Partial<CertificateTemplate>
  >({ template_type: "html", content: "" });
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

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
      initialTemplate = { name: "", template_type: "html", content: "" };
    } else {
      initialTemplate = { ...template! };
      if (initialTemplate.template_type === "html" && (initialTemplate.content === undefined || initialTemplate.content === null)) {
        initialTemplate.content = "";
      }
    }
    setCurrentTemplate(initialTemplate);
    setIsDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'sign' | 'seal') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const path = `${type}/${fileName}`;
    
    const publicUrl = await uploadAsset(file, path);
    if (publicUrl) {
      setCurrentTemplate(prev => ({
        ...prev,
        [type === 'sign' ? 'principal_sign_url' : 'college_seal_url']: publicUrl
      }));
      showSuccess(`${type === 'sign' ? 'Signature' : 'Seal'} uploaded successfully.`);
    }
    setIsUploading(false);
  };

  const handleSaveTemplate = async () => {
    if (!currentTemplate.name) {
      showError("Template name is required.");
      return;
    }

    const contentToSave = currentTemplate.content || "";

    if (!contentToSave) {
      showError("HTML content is required for templates.");
      return;
    }

    if (dialogMode === "create") {
      const newTemplatePayload: Omit<CertificateTemplate, 'id' | 'created_at' | 'file_url'> = {
        name: currentTemplate.name,
        content: contentToSave,
        template_type: "html",
        principal_sign_url: currentTemplate.principal_sign_url,
        college_seal_url: currentTemplate.college_seal_url,
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
        template_type: "html",
        principal_sign_url: currentTemplate.principal_sign_url,
        college_seal_url: currentTemplate.college_seal_url,
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>
              {dialogMode === "create" ? "Create New" : "Edit"} Template
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create" ? "Define a new certificate template using raw HTML content and upload assets." : "Modify an existing certificate template using raw HTML content and update assets."}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pr-4">
              <div className="lg:col-span-2 space-y-6">
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
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4">
                  <Label>Principal Signature</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2">
                    {currentTemplate.principal_sign_url ? (
                      <div className="relative group">
                        <img 
                          src={currentTemplate.principal_sign_url} 
                          alt="Signature" 
                          className="max-h-24 mx-auto rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setCurrentTemplate(prev => ({ ...prev, principal_sign_url: undefined }))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Upload Signature (PNG/JPG)</p>
                      </div>
                    )}
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      id="sign-upload"
                      onChange={(e) => handleFileUpload(e, 'sign')}
                      disabled={isUploading}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      asChild
                    >
                      <label htmlFor="sign-upload" className="cursor-pointer">
                        {isUploading ? "Uploading..." : "Select File"}
                      </label>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4">
                  <Label>College Seal</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2">
                    {currentTemplate.college_seal_url ? (
                      <div className="relative group">
                        <img 
                          src={currentTemplate.college_seal_url} 
                          alt="Seal" 
                          className="max-h-24 mx-auto rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setCurrentTemplate(prev => ({ ...prev, college_seal_url: undefined }))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Upload Seal (PNG/JPG)</p>
                      </div>
                    )}
                    <Input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      id="seal-upload"
                      onChange={(e) => handleFileUpload(e, 'seal')}
                      disabled={isUploading}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      asChild
                    >
                      <label htmlFor="seal-upload" className="cursor-pointer">
                        {isUploading ? "Uploading..." : "Select File"}
                      </label>
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-md space-y-2">
                  <p className="text-sm font-semibold">Dynamic Placeholders:</p>
                  <div className="grid grid-cols-1 gap-y-1 text-xs font-mono">
                    <div>{`{studentName}`}</div>
                    <div>{`{studentId}`}</div>
                    <div>{`{purpose}`}</div>
                    <div>{`{principalSign}`}</div>
                    <div>{`{collegeSeal}`}</div>
                    <div>{`{date}`}</div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t bg-muted/20">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveTemplate} disabled={isUploading}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TemplateManagement;