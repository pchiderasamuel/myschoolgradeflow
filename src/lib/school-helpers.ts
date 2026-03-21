export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export const todayStr = () => new Date().toISOString().slice(0, 10);

export function getGrade(s: number) {
  if (s >= 75) return { grade: "A1", remark: "Excellent", color: "text-accent" };
  if (s >= 70) return { grade: "B2", remark: "Very Good", color: "text-accent" };
  if (s >= 65) return { grade: "B3", remark: "Good", color: "text-primary" };
  if (s >= 60) return { grade: "C4", remark: "Credit", color: "text-primary" };
  if (s >= 55) return { grade: "C5", remark: "Credit", color: "text-primary" };
  if (s >= 50) return { grade: "C6", remark: "Credit", color: "text-primary" };
  if (s >= 45) return { grade: "D7", remark: "Pass", color: "text-warning" };
  if (s >= 40) return { grade: "E8", remark: "Pass", color: "text-warning" };
  return { grade: "F9", remark: "Fail", color: "text-destructive" };
}

export function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtTimestamp(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}
