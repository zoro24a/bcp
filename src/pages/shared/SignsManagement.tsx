import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";
import { fetchCollegeSettings, updateCollegeSettings, uploadAsset } from "@/data/appData";
import { CollegeSettings } from "@/lib/types";
import { showSuccess, showError } from "@/utils/toast";

const SignsManagement = () => {
  const [settings, setSettings] = useState<CollegeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      const data = await fetchCollegeSettings();
      setSettings(data);
      setLoading(false);
    };
    loadSettings();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'sign' | 'seal') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const fileName = `${Date.now()}-${file.name}`;
    const path = `global/${type}/${fileName}`;
    
    const publicUrl = await uploadAsset(file, path);
    if (publicUrl) {
      const updates = type === 'sign' 
        ? { principal_signature_url: publicUrl } 
        : { college_seal_url: publicUrl };
        
      const updated = await updateCollegeSettings(updates);
      if (updated) {
        setSettings(updated);
        showSuccess(`${type === 'sign' ? 'Signature' : 'Seal'} updated successfully.`);
      }
    }
    setIsUploading(null);
  };

  const handleRemove = async (type: 'sign' | 'seal') => {
    const updates = type === 'sign' 
      ? { principal_signature_url: undefined } 
      : { college_seal_url: undefined };
      
    const updated = await updateCollegeSettings(updates);
    if (updated) {
      setSettings(updated);
      showSuccess(`${type === 'sign' ? 'Signature' : 'Seal'} removed.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Signs Management</h1>
        <p className="text-muted-foreground">Manage global assets used in all certificate templates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Principal Signature */}
        <Card>
          <CardHeader>
            <CardTitle>Principal Signature</CardTitle>
            <CardDescription>This signature will be used as the default for all approved certificates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-4 bg-muted/30">
              {settings?.principal_signature_url ? (
                <div className="relative group inline-block">
                  <img 
                    src={settings.principal_signature_url} 
                    alt="Principal Signature" 
                    className="max-h-32 mx-auto rounded border bg-white p-2"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    onClick={() => handleRemove('sign')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="py-8">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No signature uploaded yet.</p>
                </div>
              )}
              
              <div className="flex justify-center">
                <Input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="sign-upload-global"
                  onChange={(e) => handleFileUpload(e, 'sign')}
                  disabled={!!isUploading}
                />
                <Button 
                  variant="outline" 
                  asChild
                  disabled={!!isUploading}
                >
                  <label htmlFor="sign-upload-global" className="cursor-pointer flex items-center gap-2">
                    {isUploading === 'sign' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {settings?.principal_signature_url ? "Change Signature" : "Upload Signature"}
                  </label>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* College Seal */}
        <Card>
          <CardHeader>
            <CardTitle>College Seal</CardTitle>
            <CardDescription>The official college seal to be displayed on all certificates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-4 bg-muted/30">
              {settings?.college_seal_url ? (
                <div className="relative group inline-block">
                  <img 
                    src={settings.college_seal_url} 
                    alt="College Seal" 
                    className="max-h-32 mx-auto rounded border bg-white p-2"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    onClick={() => handleRemove('seal')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="py-8">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">No seal uploaded yet.</p>
                </div>
              )}
              
              <div className="flex justify-center">
                <Input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="seal-upload-global"
                  onChange={(e) => handleFileUpload(e, 'seal')}
                  disabled={!!isUploading}
                />
                <Button 
                  variant="outline" 
                  asChild
                  disabled={!!isUploading}
                >
                  <label htmlFor="seal-upload-global" className="cursor-pointer flex items-center gap-2">
                    {isUploading === 'seal' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {settings?.college_seal_url ? "Change Seal" : "Upload Seal"}
                  </label>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignsManagement;