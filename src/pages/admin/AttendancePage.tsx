import { CalendarCheck2, CheckCircle2, Clock3, Users } from "lucide-react";

const stats = [
  { label: "Present", value: "92%", icon: CheckCircle2 },
  { label: "Late", value: "5%", icon: Clock3 },
  { label: "Students", value: "324", icon: Users },
];

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Attendance</h1>
        <p className="text-sm text-slate-500">Monitor daily class attendance and attendance trends.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="text-2xl font-semibold text-slate-800">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-slate-700">
          <CalendarCheck2 className="h-5 w-5" />
          <h2 className="font-semibold">Attendance overview</h2>
        </div>
        <p className="text-sm text-slate-500">This module is now available again from the admin portal.</p>
      </div>
    </div>
  );
}
