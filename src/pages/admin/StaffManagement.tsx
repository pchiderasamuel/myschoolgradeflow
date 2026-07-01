import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Users, UserPlus, MoreVertical, Loader2 } from "lucide-react";

export default function StaffManagement() {
  const { schoolId } = useAuth();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  
  useEffect(() => {
    if (schoolId) {
      loadStaff();
    }
  }, [schoolId]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("tenant_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStaffList(data || []);
    } catch (err: any) {
      toast({ title: "Failed to load staff", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !password) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);
    try {
      // Internal email generation (e.g. john-doe.tenantId@staff.internal)
      const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const internalEmail = `${slug}.${schoolId?.substring(0, 8)}@staff.internal`;

      // Call Edge Function to create user in auth.users and insert into public.staff
      // This assumes an Edge Function exists since frontend cannot call Admin API directly
      const { data, error } = await supabase.functions.invoke('create-tenant-user', {
        body: {
          tenantId: schoolId,
          role: 'staff',
          fullName,
          email: internalEmail,
          password,
        }
      });

      if (error) throw error;
      
      toast({ title: "Staff member created" });
      setFullName("");
      setPassword("");
      loadStaff();
    } catch (err: any) {
      toast({ title: "Error creating staff", description: err.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const toggleStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("staff").update({ is_active: !currentStatus }).eq("id", staffId);
      if (error) throw error;
      loadStaff();
      toast({ title: `Staff ${currentStatus ? 'deactivated' : 'activated'}` });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    }
  };

  const resetPassword = async (staffId: string) => {
    // This would typically also call an Edge Function to generate a temp password and reset it
    toast({ title: "Password Reset functionality to be implemented via Edge Function" });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={24} /> Staff Management
          </h1>
          <p className="text-slate-500">Manage your school's staff accounts and access.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <UserPlus size={18} /> Add New Staff
          </h3>
          <form onSubmit={handleCreateStaff} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
              <input
                type="password"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="mt-2 bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : "Create Account"}
            </button>
          </form>
        </div>

        {/* Staff List */}
        <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-semibold text-lg">Staff Directory</h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <Loader2 className="animate-spin mb-2" size={24} /> Loading staff...
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No staff members found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((staff) => (
                    <tr key={staff.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{staff.full_name}</td>
                      <td className="px-4 py-3 capitalize">{staff.role}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${staff.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {staff.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => toggleStatus(staff.id, staff.is_active)}
                            className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                          >
                            {staff.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button 
                            onClick={() => resetPassword(staff.id)}
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
