import { BookOpen, FileText, FolderOpen, GraduationCap } from "lucide-react";

const items = [
  { title: "Lesson Plans", description: "Shared teacher materials and lesson content.", icon: FileText },
  { title: "Class Resources", description: "Topic packs, worksheets, and reference notes.", icon: FolderOpen },
  { title: "Academic Guides", description: "Exam guides, rubrics, and study resources.", icon: GraduationCap },
];

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Resources</h1>
        <p className="text-sm text-slate-500">Keep school-wide academic materials available to staff and students.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-slate-800">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        This placeholder module is now available again in the admin portal navigation.
      </div>
    </div>
  );
}
