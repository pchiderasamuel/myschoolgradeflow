import { BarChart3, Trophy, TrendingUp } from "lucide-react";

const cards = [
  { title: "Published Results", value: "18", icon: Trophy },
  { title: "Average Score", value: "78%", icon: TrendingUp },
  { title: "Pending Review", value: "4", icon: BarChart3 },
];

export default function ResultsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Results</h1>
        <p className="text-sm text-slate-500">Generate and review academic results for each term.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm text-slate-500">{card.title}</p>
              <p className="text-2xl font-semibold text-slate-800">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Result generation and reporting are available again from the admin portal.</p>
      </div>
    </div>
  );
}
