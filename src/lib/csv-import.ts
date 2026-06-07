// CSV Import utility for class rolls

export interface ParsedStudent {
  name: string;
  admNo: string;
}

export function parseCSV(text: string): ParsedStudent[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("name") || firstLine.includes("student") || firstLine.includes("admission");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      // Handle CSV with commas or tabs
      const parts = line.includes(",") ? line.split(",") : line.includes("\t") ? line.split("\t") : [line];
      const name = (parts[0] || "").replace(/^["']|["']$/g, "").trim();
      const admNo = (parts[1] || "").replace(/^["']|["']$/g, "").trim();
      return { name, admNo };
    })
    .filter((s) => s.name.length > 0);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      // Validate result is actually a string
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else if (reader.result instanceof ArrayBuffer) {
        // Fallback: convert ArrayBuffer to string
        try {
          const decoder = new TextDecoder();
          resolve(decoder.decode(reader.result));
        } catch (err) {
          reject(new Error("Failed to decode file content"));
        }
      } else {
        reject(new Error("Unexpected file read result type"));
      }
    };
    
    reader.onerror = () => {
      const errorMsg = reader.error?.message || "Unknown error";
      reject(new Error(`Failed to read file: ${errorMsg}`));
    };
    
    reader.onabort = () => {
      reject(new Error("File read was aborted"));
    };
    
    reader.readAsText(file);
  });
}
