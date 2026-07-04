import ResultsPage from "@/pages/teacher/ResultsPage";

export default function RecordsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Records</h1>
        <p className="text-sm text-slate-500">Manage student scores and generated results records.</p>
      </div>
      <ResultsPage />
    </div>
  );
}
