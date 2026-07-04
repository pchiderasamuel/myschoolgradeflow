import { ClipboardList, GraduationCap, Sparkles } from "lucide-react";

export default function ScoreEntryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Score Entry</h1>
        <p className="text-sm text-slate-500">Capture student assessment scores and publish them to reports.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <ClipboardList className="h-5 w-5" />
            <h2 className="font-semibold">Assessment capture</h2>
          </div>
          <p className="text-sm text-slate-500">
            This section is now available again so teachers and admins can manage score entry from the school portal.
          </p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-800">Ready for reporting</h2>
          <p className="mt-2 text-sm text-slate-600">
            Scores entered here can flow into results and records views without leaving the portal.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-indigo-700">
            <Sparkles className="h-4 w-4" />
            Restored module
          </div>
        </div>
      </div>
    </div>
  );
}
