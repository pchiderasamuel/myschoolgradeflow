// Data Import utilities

export interface ParsedScore {
  studentName: string;
  studentClass: string;
  subject: string;
  ca: number;
  exam: number;
  total: number;
}

export function parseScoresCSV(text: string, defaultClass: string, defaultTerm: string, defaultSession: string): ParsedScore[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("name") || firstLine.includes("student") || firstLine.includes("subject") || firstLine.includes("score");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = line.includes(",") ? line.split(",") : line.includes("\t") ? line.split("\t") : [line];
      const cleaned = parts.map((p) => p.replace(/^["']|["']$/g, "").trim());

      // Expected: Name, Subject, CA, Exam (optionally Class as 5th column)
      const studentName = cleaned[0] || "";
      const subject = cleaned[1] || "";
      const ca = Math.min(40, Math.max(0, parseFloat(cleaned[2]) || 0));
      const exam = Math.min(60, Math.max(0, parseFloat(cleaned[3]) || 0));
      const studentClass = cleaned[4] || defaultClass;

      if (!studentName || !subject) return null;

      return { studentName, studentClass, subject, ca, exam, total: ca + exam };
    })
    .filter(Boolean) as ParsedScore[];
}

export interface BackupData {
  _type: string;
  _version: number;
  entries?: any[];
  bin?: any[];
  logs?: any[];
  comments?: Record<string, any>;
  attendance?: any[];
  classRolls?: Record<string, any>;
  staffList?: any[];
  schoolSettings?: any;
  adminPin?: string;
}

export function validateBackup(data: any): { valid: boolean; error?: string; data?: BackupData } {
  if (!data || typeof data !== "object") return { valid: false, error: "Invalid file format" };

  // Check if it's our backup format
  if (data._type === "schoolapp_backup") {
    return { valid: true, data };
  }

  // Also accept raw localStorage format (entries array present)
  if (Array.isArray(data.entries)) {
    return { valid: true, data: { _type: "schoolapp_backup", _version: 1, ...data } };
  }

  return { valid: false, error: "Unrecognized backup format. Expected a SchoolApp backup file." };
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
