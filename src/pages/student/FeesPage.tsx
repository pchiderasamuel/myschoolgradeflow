import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSchool } from "@/hooks/useSchool";
import { getPayments, Payment } from "@/supabase/schoolService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed:  "bg-red-100 text-red-600",
};

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format(amount);
}

export default function StudentFeesPage() {
  const { schoolId, profile } = useAuth();
  const { school } = useSchool();
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime subscription for payment status updates
  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel(`student_payments:${schoolId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `school_id=eq.${schoolId}` },
        (payload: { new: Payment }) => {
          setPayments((prev) =>
            prev.map((p) => p.id === payload.new.id ? { ...p, ...payload.new } : p)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId]);

  const load = async () => {
    if (!schoolId || !profile?.userId) return;
    setLoading(true);
    try {
      const p = await getPayments(schoolId, { student_id: profile.userId });
      setPayments(p);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [schoolId, profile?.userId]); // eslint-disable-line



  const generateReceipt = (p: Payment) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(school?.name || "School", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Payment Receipt", 14, 30);
    
    // Line separator
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(14, 35, 196, 35);
    
    // Details
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85); // slate-700
    
    const details = [
      ["Receipt No:", p.reference || p.id.split("-")[0].toUpperCase()],
      ["Date Paid:", p.paid_at ? new Date(p.paid_at).toLocaleString() : new Date(p.created_at).toLocaleString()],
      ["Student:", p.student_name],
      ["Fee Name:", p.fee_name],
      ["Amount:", formatNaira(Number(p.amount))],
      ["Status:", p.status.toUpperCase()],
      ["Payment Channel:", p.channel || "Online"],
    ];
    
    autoTable(doc, {
      startY: 45,
      body: details,
      theme: "plain",
      styles: { fontSize: 12, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: "bold", textColor: [30, 41, 59], cellWidth: 50 },
        1: { textColor: [71, 85, 105] }
      }
    });
    
    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Thank you for your payment.", 14, finalY + 20);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, finalY + 28);
    
    doc.save(`receipt-${p.reference || "payment"}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Fees & Receipts</h1>
        <p className="text-sm text-slate-500 mt-1">View your payment history and generate receipts for successful payments.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download className="text-slate-400 w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">No payment records</h3>
            <p className="text-sm text-slate-500">You don't have any fees assigned or payment history yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fee Details</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{p.fee_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">Ref: {p.reference ?? "Pending"}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {formatNaira(p.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[p.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.status === "pending" ? (
                        <span className="text-xs text-slate-500 italic px-2">Pay at school office</span>
                      ) : p.status === "success" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-slate-600 hover:text-slate-900 border-slate-200"
                          onClick={() => generateReceipt(p)}
                        >
                          <Download size={14} className="mr-1.5" /> Receipt
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Failed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
