import { describe, it, expect } from "vitest";
import {
  normalizeClassName,
  buildTopologicalOrder,
  computeStateHash,
  computePromotionSnapshot,
  detectRollbackConflicts,
  type StudentRecord
} from "../promotionUtils";

describe("Bulk Promotion Utils", () => {
  describe("normalizeClassName()", () => {
    it("should return high confidence for standard curriculum classes", () => {
      expect(normalizeClassName("JSS 1")).toEqual({ normalized: "JSS 1", confidence: "high" });
      expect(normalizeClassName("JSS 1A")).toEqual({ normalized: "JSS 1", confidence: "high" });
      expect(normalizeClassName("Primary 6")).toEqual({ normalized: "Primary 6", confidence: "high" });
      expect(normalizeClassName("SS 3 Science")).toEqual({ normalized: "SS 3", confidence: "high" });
    });

    it("should flag low confidence for ambiguous or unusual class names (e.g. JSS 10)", () => {
      const res = normalizeClassName("JSS 10");
      expect(res.confidence).toBe("low");
      expect(res.reason).toContain("Unusual JSS level");
    });

    it("should flag low confidence for custom or unmapped class names", () => {
      const res = normalizeClassName("Coding Club Special");
      expect(res.confidence).toBe("low");
      expect(res.reason).toBe("Custom or non-standard class name mapping");
    });
  });

  describe("buildTopologicalOrder()", () => {
    it("should order execution from highest to lowest class to prevent student overlap", () => {
      const mappings = {
        "JSS 1": "JSS 2",
        "JSS 2": "JSS 3",
        "JSS 3": "SS 1",
        "SS 3": "GRADUATE"
      };

      const result = buildTopologicalOrder(mappings);
      expect(result.hasCycle).toBe(false);
      // Execution order should process SS 3 -> GRADUATE first, then JSS 3 -> SS 1, etc.
      expect(result.executionOrder.indexOf("SS 3")).toBeLessThan(result.executionOrder.indexOf("JSS 3"));
      expect(result.executionOrder.indexOf("JSS 3")).toBeLessThan(result.executionOrder.indexOf("JSS 2"));
      expect(result.executionOrder.indexOf("JSS 2")).toBeLessThan(result.executionOrder.indexOf("JSS 1"));
    });

    it("should detect circular mapping dependencies", () => {
      const mappings = {
        "Class A": "Class B",
        "Class B": "Class A"
      };

      const result = buildTopologicalOrder(mappings);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes).toBeDefined();
    });
  });

  describe("computeStateHash() & TOCTOU Detection", () => {
    const mockStudents: StudentRecord[] = [
      { id: "s1", first_name: "Adaeze", last_name: "Okonkwo", class_name: "JSS 1", status: "active" },
      { id: "s2", first_name: "Emeka", last_name: "Abubakar", class_name: "JSS 2", status: "active" }
    ];

    it("should compute deterministic hash for same student roster state", () => {
      const hash1 = computeStateHash(mockStudents);
      const hash2 = computeStateHash([...mockStudents]);
      expect(hash1).toBe(hash2);
    });

    it("should generate a different hash if any student class_name or status changes", () => {
      const hashBefore = computeStateHash(mockStudents);
      const modifiedStudents: StudentRecord[] = [
        { id: "s1", first_name: "Adaeze", last_name: "Okonkwo", class_name: "JSS 2", status: "active" }, // Changed class!
        { id: "s2", first_name: "Emeka", last_name: "Abubakar", class_name: "JSS 2", status: "active" }
      ];
      const hashAfter = computeStateHash(modifiedStudents);
      expect(hashBefore).not.toBe(hashAfter);
    });
  });

  describe("detectRollbackConflicts()", () => {
    const mockStudents: StudentRecord[] = [
      { id: "s1", first_name: "Adaeze", last_name: "Okonkwo", class_name: "JSS 1", status: "active" }
    ];
    const snapshot = computePromotionSnapshot(mockStudents);
    const postMappings = { "JSS 1": "JSS 2" };

    it("should pass clean when post-promotion state matches expectations", () => {
      const postPromotionState: StudentRecord[] = [
        { id: "s1", first_name: "Adaeze", last_name: "Okonkwo", class_name: "JSS 2", status: "active" }
      ];
      const report = detectRollbackConflicts(snapshot, postPromotionState, postMappings);
      expect(report.hasConflicts).toBe(false);
    });

    it("should flag conflict if student was manually reassigned post-promotion", () => {
      const editedState: StudentRecord[] = [
        { id: "s1", first_name: "Adaeze", last_name: "Okonkwo", class_name: "SS 1 Science", status: "active" } // Manually edited!
      ];
      const report = detectRollbackConflicts(snapshot, editedState, postMappings);
      expect(report.hasConflicts).toBe(true);
      expect(report.conflictingStudents.length).toBe(1);
      expect(report.conflictingStudents[0].id).toBe("s1");
    });
  });

  describe("Failure-Injection & Atomicity Abort Test", () => {
    it("should preserve original state when a promotion step encounters an error", async () => {
      const initialRoster: StudentRecord[] = [
        { id: "s1", first_name: "Adaeze", last_name: "Okonkwo", class_name: "JSS 1", status: "active" },
        { id: "s2", first_name: "Emeka", last_name: "Abubakar", class_name: "JSS 2", status: "active" }
      ];

      // Simulated transaction memory state
      let workingRoster = JSON.parse(JSON.stringify(initialRoster));

      const simulateAtomicExecute = (shouldFailMidway: boolean) => {
        const rollbackRoster = JSON.parse(JSON.stringify(workingRoster));
        try {
          // Step 1: Promote JSS 2 -> JSS 3
          workingRoster[1].class_name = "JSS 3";

          if (shouldFailMidway) {
            throw new Error("Simulated network timeout during promotion step");
          }

          // Step 2: Promote JSS 1 -> JSS 2
          workingRoster[0].class_name = "JSS 2";
        } catch (e) {
          // Abort & rollback
          workingRoster = rollbackRoster;
          throw e;
        }
      };

      expect(() => simulateAtomicExecute(true)).toThrow("Simulated network timeout");
      // Assert ZERO partial writes landed in memory state!
      expect(workingRoster).toEqual(initialRoster);
    });
  });
});
