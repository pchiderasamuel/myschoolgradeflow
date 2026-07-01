import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { GraduationCap, UserPlus, Loader2 } from "lucide-react";

export default function StudentManagement() {
  const { schoolId } = useAuth();
  const [studentList, setStudentList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [password, setPassword] = useState("");
  
  useEffect(() => {
    if (schoolId) {
      loadStudents();
    }
  }, [schoolId]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("tenant_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudentList(data || []);
    } catch (err: any) {
      toast({ title: "Failed to load students", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !matricNumber || !password) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);
    try {
      // Internal email generation (e.g. 123456.tenantId@student.internal)
      const internalEmail = `${matricNumber.toLowerCase()}.${schoolId?.substring(0, 8)}@student.internal`;

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('create-tenant-user', {
        body: {
          tenantId: schoolId,
          role: 'student',
          fullName,
          matricNumber,
          email: internalEmail,
          password,
        }
      });

      if (error) throw error;
      
      toast({ title: "Student member created" });
      setFullName("");
      setMatricNumber("");
      setPassword("");
      loadStudents();
    } catch (err: any) {
      toast({ title: "Error creating student", description: err.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const toggleStatus = async (studentId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("students").update({ is_active: !currentStatus }).eq("id", studentId);
      if (error) throw error;
      loadStudents();
      toast({ title: `Student ${currentStatus ? 'deactivated' : 'activated'}` });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    }
  };

  const resetPassword = async (studentId: string) => {
    toast({ title: "Password Reset functionality to be implemented via Edge Function" });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap size={24} /> Student Management
          </h1>
          <p className="text-slate-500">Manage your school's student accounts and access.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="bg-white p-5 rounded-lg border shadow-sm">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <UserPlus size={18} /> Add New Student
          </h3>
          <form onSubmit={handleCreateStudent} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Smith"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Matric Number</label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                placeholder="e.g. MAT2026001"
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

        {/* Student List */}
        <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-semibold text-lg">Student Directory</h3>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center">
              <Loader2 className="animate-spin mb-2" size={24} /> Loading students...
            </div>
          ) : studentList.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No students found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Matric No.</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentList.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{student.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">{student.matric_number}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {student.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => toggleStatus(student.id, student.is_active)}
                            className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                          >
                            {student.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button 
                            onClick={() => resetPassword(student.id)}
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
