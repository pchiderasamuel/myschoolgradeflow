import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PenTool, Type, Save, Trash2, CheckCircle } from "lucide-react";
import SignaturePad from "@/components/school/utils/SignaturePad";

export default function SettingsPage() {
  const { user, schoolId } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signatureType, setSignatureType] = useState<"typed" | "drawn">("drawn");
  const [drawnSignature, setDrawnSignature] = useState("");
  const [typedSignature, setTypedSignature] = useState("");
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedType, setSavedType] = useState<"typed" | "drawn" | null>(null);

  useEffect(() => {
    if (!user || !schoolId) return;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("staff_settings")
          .select("signature, signature_type")
          .eq("user_id", user.id)
          .eq("school_id", schoolId)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setSavedSignature(data.signature);
          setSavedType(data.signature_type as "typed" | "drawn");
          setSignatureType(data.signature_type as "typed" | "drawn");
          if (data.signature_type === "typed") {
            setTypedSignature(data.signature);
          } else {
            setDrawnSignature(data.signature);
          }
        }
      } catch (err: any) {
        toast({ title: "Error fetching settings", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user, schoolId, toast]);

  const handleSave = async () => {
    if (!user || !schoolId) return;

    const signatureToSave = signatureType === "typed" ? typedSignature : drawnSignature;
    
    if (!signatureToSave) {
      toast({ title: "Empty Signature", description: "Please provide a signature before saving.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_staff_signature", {
        p_school_id: schoolId,
        p_signature: signatureToSave,
        p_signature_type: signatureType
      });

      if (error) throw error;

      setSavedSignature(signatureToSave);
      setSavedType(signatureType);
      toast({ title: "Settings Saved", description: "Your e-signature has been updated successfully." });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!user || !schoolId) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_staff_signature", {
        p_school_id: schoolId,
        p_signature: null,
        p_signature_type: null
      });

      if (error) throw error;

      setSavedSignature(null);
      setSavedType(null);
      setDrawnSignature("");
      setTypedSignature("");
      toast({ title: "Signature Cleared", description: "Your e-signature has been removed." });
    } catch (err: any) {
      toast({ title: "Failed to clear", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-400 w-8 h-8" />
      </div>
    );
  }

  const isCurrentSelectionSaved = savedSignature && savedType === signatureType && 
    (signatureType === "typed" ? typedSignature === savedSignature : drawnSignature === savedSignature);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 uppercase">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your staff preferences and profile tools</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool size={18} className="text-indigo-600" /> E-Signature
          </CardTitle>
          <CardDescription>
            Set your default e-signature to automatically sign student reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {savedSignature && (
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase text-indigo-700 tracking-wider mb-2">Current Saved Signature</p>
                <div className="bg-white p-3 rounded-lg border border-indigo-200 min-w-[200px] flex items-center justify-center">
                  {savedType === "typed" ? (
                    <span className="font-caveat text-4xl text-slate-800">{savedSignature}</span>
                  ) : (
                    <img src={savedSignature} alt="Saved signature" className="max-h-[60px]" />
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 size={16} className="mr-2" /> Remove
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Update Signature</h3>
            <Tabs value={signatureType} onValueChange={(val: any) => setSignatureType(val)}>
              <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                <TabsTrigger value="drawn" className="flex items-center gap-2">
                  <PenTool size={14} /> Draw
                </TabsTrigger>
                <TabsTrigger value="typed" className="flex items-center gap-2">
                  <Type size={14} /> Type
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="drawn" className="pt-4">
                <div className="max-w-[400px]">
                  <SignaturePad value={drawnSignature} onChange={setDrawnSignature} />
                </div>
              </TabsContent>
              
              <TabsContent value="typed" className="pt-4 space-y-4">
                <div className="max-w-[400px]">
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Type your name</label>
                  <Input 
                    placeholder="Jane Doe" 
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                  />
                </div>
                
                {typedSignature && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Preview</label>
                    <div className="p-6 border-2 border-slate-200 rounded-lg bg-white flex items-center justify-center min-h-[100px] max-w-[400px]">
                      <span className="font-caveat text-5xl text-slate-800">{typedSignature}</span>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || isCurrentSelectionSaved}>
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              {isCurrentSelectionSaved ? "Saved" : "Save Signature"}
            </Button>
            {isCurrentSelectionSaved && (
              <span className="flex items-center text-sm font-medium text-emerald-600">
                <CheckCircle size={16} className="mr-1" /> Up to date
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
