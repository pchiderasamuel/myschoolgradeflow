/**
 * schoolService.ts — Tenant-scoped query service for Phase 4.
 *
 * Rules:
 *  - schoolId is NEVER accepted as a parameter from the UI.
 *    It is read from the auth context and passed internally.
 *  - Every query adds .eq('school_id', schoolId) for defence-in-depth
 *    in addition to RLS policies.
 *  - All functions throw with a descriptive message on Supabase error.
 *  - UI components import ONLY from this file, never call supabase directly.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PostgrestQueryBuilder } from "@supabase/postgrest-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function from(table: string): PostgrestQueryBuilder<any, any, any, any> {
  return supabase.from(table);
}

// ─── Types ────────────────────────────────────────────────────────────

export interface School {
  id: string;
  tenant_id?: string | null;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string;
  logo: string | null;
  timezone: string;
  academic_year: string;
  current_term: "first" | "second" | "third";
  features: Record<string, boolean>;
  max_students: number;
  current_students: number;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  other_names: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | null;
  photo: string | null;
  class_id: string | null;
  class_name: string | null;
  status: "active" | "graduated" | "withdrawn";
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_relationship: string | null;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  school_id: string;
  auth_user_id: string | null;
  employee_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: "teacher" | "head_teacher" | "principal" | "school_admin";
  subject_ids: string[];
  class_ids: string[];
  is_class_teacher: boolean;
  class_teacher_of: string | null;
  status: "active" | "on_leave" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  level: string | null;
  arm: string | null;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  student_count: number;
  academic_year: string;
  term: "first" | "second" | "third";
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string;
}

export interface TimeSlot {
  id: string;
  school_id: string;
  label: string;
  start_time: string;
  end_time: string;
  slot_type: "lesson" | "break" | "assembly" | "lunch" | "closing";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  school_id: string;
  class_id: string;
  class_name: string;
  date: string;
  term: "first" | "second" | "third";
  academic_year: string;
  taken_by: string;
  taken_by_name: string;
  records: Record<string, { present: boolean; remark?: string }>;
  present_count: number;
  absent_count: number;
  created_at: string;
}

export interface Result {
  id?: string;
  school_id: string;
  student_id: string;
  student_name: string;
  admission_no: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id?: string | null;
  academic_year: string;
  term: "first" | "second" | "third";
  score_ca1?: number | null;
  score_ca2?: number | null;
  score_exam?: number | null;
  score_total?: number | null;
  grade?: string | null;
  remark?: string | null;
  teacher_comment?: string | null;
}

export interface Fee {
  id: string;
  school_id: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string | null;
  term: "first" | "second" | "third";
  academic_year: string;
  applicable_to: string[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  school_id: string;
  student_id: string;
  student_name: string;
  fee_id: string;
  fee_name: string;
  amount: number;
  currency: string;
  reference: string | null;
  status: "pending" | "success" | "failed";
  channel: string | null;
  paid_by: string | null;
  paid_at: string | null;
  created_at: string;
}

// ─── Internal helper ──────────────────────────────────────────────────

function requireSchoolId(schoolId: string | null | undefined): string {
  if (!schoolId) throw new Error("No school assigned to current user");
  return schoolId;
}

function throwIfError(error: unknown, context: string): void {
  if (error && typeof error === "object" && "message" in error) {
    throw new Error(`${context}: ${(error as { message: string }).message}`);
  }
}

// ─── School Profile ────────────────────────────────────────────────────

export async function getSchoolProfile(schoolId: string | null): Promise<School> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await from("schools")
    .select("*")
    .eq("id", sid)
    .single();
  throwIfError(error, "getSchoolProfile");
  return data as School;
}

export async function updateSchoolProfile(
  schoolId: string | null,
  updates: Partial<School>
): Promise<School> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await from("schools")
    .update(updates)
    .eq("id", sid)
    .select()
    .single();
  throwIfError(error, "updateSchoolProfile");
  return data as School;
}

// ─── Students ─────────────────────────────────────────────────────────

export interface StudentSummary {
  total: number;
  male: number;
  female: number;
  unspecified: number;
}

export async function getStudentSummary(
  schoolId: string | null,
  classId?: string
): Promise<StudentSummary> {
  const sid = requireSchoolId(schoolId);
  let query = db()
    .from("students")
    .select("id, gender")
    .eq("school_id", sid)
    .eq("status", "active");

  if (classId) query = query.eq("class_id", classId);

  const { data, error } = await query;
  throwIfError(error, "getStudentSummary");

  const rows = (data ?? []) as { id: string; gender: string | null }[];
  const total       = rows.length;
  const male        = rows.filter((s) => s.gender === "male").length;
  const female      = rows.filter((s) => s.gender === "female").length;
  const unspecified = total - male - female;
  return { total, male, female, unspecified };
}

export async function getStudents(
  schoolId: string | null,
  filters?: { class_id?: string; status?: string }
): Promise<Student[]> {
  const sid = requireSchoolId(schoolId);
  let query = db()
    .from("students")
    .select("*")
    .eq("school_id", sid)
    .order("last_name", { ascending: true });

  if (filters?.class_id) query = query.eq("class_id", filters.class_id);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  throwIfError(error, "getStudents");
  return (data ?? []) as Student[];
}

export async function getStudent(schoolId: string | null, studentId: string): Promise<Student> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("students")
    .select("*")
    .eq("id", studentId)
    .eq("school_id", sid)
    .single();
  throwIfError(error, "getStudent");
  return data as Student;
}

export async function createStudent(
  schoolId: string | null,
  data: Omit<Student, "id" | "school_id" | "created_at" | "updated_at" | "enrolled_at">
): Promise<Student> {
  const sid = requireSchoolId(schoolId);
  const { data: row, error } = await db()
    .from("students")
    .insert({ ...data, school_id: sid })
    .select()
    .single();
  throwIfError(error, "createStudent");
  return row as Student;
}

export async function updateStudent(
  schoolId: string | null,
  studentId: string,
  updates: Partial<Student>
): Promise<Student> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("students")
    .update(updates)
    .eq("id", studentId)
    .eq("school_id", sid)
    .select()
    .single();
  throwIfError(error, "updateStudent");
  return data as Student;
}

export async function archiveStudent(
  schoolId: string | null,
  studentId: string
): Promise<void> {
  const sid = requireSchoolId(schoolId);
  const { error } = await db()
    .from("students")
    .update({ status: "withdrawn" })
    .eq("id", studentId)
    .eq("school_id", sid);
  throwIfError(error, "archiveStudent");
}

export async function bulkCreateStudents(
  schoolId: string | null,
  rows: Omit<Student, "id" | "school_id" | "created_at" | "updated_at" | "enrolled_at">[]
): Promise<{ inserted: number; errors: { row: number; reason: string }[] }> {
  const sid = requireSchoolId(schoolId);
  const CHUNK = 500;
  let inserted = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, school_id: sid }));
    const { data, error } = await db()
      .from("students")
      .insert(chunk)
      .select("id");

    if (error) {
      errors.push({ row: i, reason: error.message });
    } else {
      inserted += (data ?? []).length;
    }
  }
  return { inserted, errors };
}

// ─── Teachers ─────────────────────────────────────────────────────────

export async function getTeachers(schoolId: string | null): Promise<Teacher[]> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("teachers")
    .select("*")
    .eq("school_id", sid)
    .order("last_name", { ascending: true });
  throwIfError(error, "getTeachers");
  return (data ?? []) as Teacher[];
}

export async function createTeacher(
  schoolId: string | null,
  teacherData: Omit<Teacher, "id" | "school_id" | "created_at" | "updated_at">,
  adminEmail?: string
): Promise<Teacher> {
  const sid = requireSchoolId(schoolId);

  const { data: row, error: teacherError } = await db()
    .from("teachers")
    .insert({ ...teacherData, school_id: sid })
    .select()
    .single();
  throwIfError(teacherError, "createTeacher");

  // Also insert pre_registration so the teacher can sign up and auto-get their role
  if (adminEmail) {
    await db()
      .from("pre_registrations")
      .insert({
        school_id: sid,
        email: adminEmail.toLowerCase(),
        role: teacherData.role ?? "teacher",
      })
      .select("id")
      .single();
    // Not throwing on pre_reg conflict (23505 = duplicate) — teacher record still created
  }

  return row as Teacher;
}

export async function updateTeacher(
  schoolId: string | null,
  teacherId: string,
  updates: Partial<Teacher>
): Promise<Teacher> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("teachers")
    .update(updates)
    .eq("id", teacherId)
    .eq("school_id", sid)
    .select()
    .single();
  throwIfError(error, "updateTeacher");
  return data as Teacher;
}

// ─── Classes ──────────────────────────────────────────────────────────

export async function getClasses(schoolId: string | null): Promise<Class[]> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("classes")
    .select("*")
    .eq("school_id", sid)
    .order("name", { ascending: true });
  throwIfError(error, "getClasses");
  return (data ?? []) as Class[];
}

export async function createClass(
  schoolId: string | null,
  classData: Omit<Class, "id" | "school_id" | "created_at" | "updated_at" | "student_count">
): Promise<Class> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("classes")
    .insert({ ...classData, school_id: sid })
    .select()
    .single();
  throwIfError(error, "createClass");
  return data as Class;
}

export async function updateClass(
  schoolId: string | null,
  classId: string,
  updates: Partial<Class>
): Promise<Class> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("classes")
    .update(updates)
    .eq("id", classId)
    .eq("school_id", sid)
    .select()
    .single();
  throwIfError(error, "updateClass");
  return data as Class;
}

// ─── Subjects ─────────────────────────────────────────────────────────

export async function getSubjects(schoolId: string | null): Promise<Subject[]> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("subjects")
    .select("*")
    .eq("school_id", sid)
    .order("name", { ascending: true });
  throwIfError(error, "getSubjects");
  return (data ?? []) as Subject[];
}

export async function saveSubject(schoolId: string | null, subject: Omit<Subject, "id" | "school_id" | "created_at" | "updated_at">): Promise<Subject> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("subjects")
    .insert({
      school_id: sid,
      name: subject.name,
      code: subject.code,
      description: subject.description,
    })
    .select()
    .single();
  throwIfError(error, "saveSubject");
  return data as Subject;
}

// ─── Time Slots ─────────────────────────────────────────────────────────

export async function getTimeSlots(schoolId: string | null): Promise<TimeSlot[]> {
  const sid = requireSchoolId(schoolId);
  console.log("[getTimeSlots] Fetching time slots for school:", sid);
  const { data, error } = await db()
    .from("time_slots")
    .select("*")
    .eq("school_id", sid)
    .order("sort_order", { ascending: true });
  console.log("[getTimeSlots] Response:", { data, error });
  throwIfError(error, "getTimeSlots");
  return (data ?? []) as TimeSlot[];
}

export async function saveTimeSlot(schoolId: string | null, timeSlot: Omit<TimeSlot, "id" | "school_id" | "created_at" | "updated_at">): Promise<TimeSlot> {
  const sid = requireSchoolId(schoolId);
  console.log("[saveTimeSlot] Saving time slot:", { schoolId: sid, timeSlot });
  const { data, error } = await db()
    .from("time_slots")
    .insert({
      school_id: sid,
      label: timeSlot.label,
      start_time: timeSlot.start_time,
      end_time: timeSlot.end_time,
      slot_type: timeSlot.slot_type,
      sort_order: timeSlot.sort_order,
    })
    .select()
    .single();
  console.log("[saveTimeSlot] Response:", { data, error });
  throwIfError(error, "saveTimeSlot");
  return data as TimeSlot;
}

export async function updateTimeSlot(schoolId: string | null, id: string, timeSlot: Partial<Omit<TimeSlot, "id" | "school_id" | "created_at" | "updated_at">>): Promise<TimeSlot> {
  const sid = requireSchoolId(schoolId);
  console.log("[updateTimeSlot] Updating time slot:", { schoolId: sid, id, timeSlot });
  const { data, error } = await db()
    .from("time_slots")
    .update({
      label: timeSlot.label,
      start_time: timeSlot.start_time,
      end_time: timeSlot.end_time,
      slot_type: timeSlot.slot_type,
      sort_order: timeSlot.sort_order,
    })
    .eq("id", id)
    .eq("school_id", sid)
    .select()
    .single();
  console.log("[updateTimeSlot] Response:", { data, error });
  throwIfError(error, "updateTimeSlot");
  return data as TimeSlot;
}

export async function deleteTimeSlot(schoolId: string | null, id: string): Promise<void> {
  const sid = requireSchoolId(schoolId);
  console.log("[deleteTimeSlot] Deleting time slot:", { schoolId: sid, id });
  const { error } = await db()
    .from("time_slots")
    .delete()
    .eq("id", id)
    .eq("school_id", sid);
  console.log("[deleteTimeSlot] Response:", { error });
  throwIfError(error, "deleteTimeSlot");
}

// ─── Attendance ────────────────────────────────────────────────────────

export async function getAttendance(
  schoolId: string | null,
  classId: string,
  date: string
): Promise<AttendanceRecord | null> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("attendance")
    .select("*")
    .eq("school_id", sid)
    .eq("class_id", classId)
    .eq("date", date)
    .maybeSingle();
  throwIfError(error, "getAttendance");
  return data as AttendanceRecord | null;
}

export async function saveAttendance(
  schoolId: string | null,
  payload: Omit<AttendanceRecord, "id" | "school_id" | "created_at">
): Promise<AttendanceRecord> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("attendance")
    .upsert({ ...payload, school_id: sid }, { onConflict: "school_id,class_id,date" })
    .select()
    .single();
  throwIfError(error, "saveAttendance");
  return data as AttendanceRecord;
}

export async function getAttendanceSummary(
  schoolId: string | null,
  classId: string,
  term: string
): Promise<{ date: string; present_count: number; absent_count: number }[]> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("attendance")
    .select("date, present_count, absent_count")
    .eq("school_id", sid)
    .eq("class_id", classId)
    .eq("term", term)
    .order("date", { ascending: true });
  throwIfError(error, "getAttendanceSummary");
  return data ?? [];
}

// ─── Results ──────────────────────────────────────────────────────────

export async function getResults(
  schoolId: string | null,
  filters: {
    student_id?: string;
    class_id?: string;
    term?: string;
    academic_year?: string;
  }
): Promise<Result[]> {
  const sid = requireSchoolId(schoolId);
  let query = db()
    .from("results")
    .select("*")
    .eq("school_id", sid);

  if (filters.student_id) query = query.eq("student_id", filters.student_id);
  if (filters.class_id) query = query.eq("class_id", filters.class_id);
  if (filters.term) query = query.eq("term", filters.term);
  if (filters.academic_year) query = query.eq("academic_year", filters.academic_year);

  const { data, error } = await query.order("student_name", { ascending: true });
  throwIfError(error, "getResults");
  return (data ?? []) as Result[];
}

export async function saveResult(
  schoolId: string | null,
  payload: Omit<Result, "score_total" | "grade" | "remark">
): Promise<Result> {
  const sid = requireSchoolId(schoolId);
  // Explicitly omit computed fields — trigger sets them server-side
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { score_total: _st, grade: _g, remark: _r, ...safe } = payload as any;
  void _st; void _g; void _r;

  const { data, error } = await db()
    .from("results")
    .upsert({ ...safe, school_id: sid }, {
      onConflict: "school_id,student_id,subject_id,term,academic_year",
    })
    .select()
    .single();
  throwIfError(error, "saveResult");
  return data as Result;
}

export async function bulkSaveResults(
  schoolId: string | null,
  rows: Omit<Result, "score_total" | "grade" | "remark">[]
): Promise<Result[]> {
  const sid = requireSchoolId(schoolId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safe = (rows as any[]).map(({ score_total: _st, grade: _g, remark: _r, ...r }: any) => {
    void _st; void _g; void _r;
    return { ...r, school_id: sid };
  });

  const { data, error } = await db()
    .from("results")
    .upsert(safe, { onConflict: "school_id,student_id,subject_id,term,academic_year" })
    .select();
  throwIfError(error, "bulkSaveResults");
  return (data ?? []) as Result[];
}

// ─── Fees ─────────────────────────────────────────────────────────────

export async function getFees(schoolId: string | null, term?: string): Promise<Fee[]> {
  const sid = requireSchoolId(schoolId);
  let query = db()
    .from("fees")
    .select("*")
    .eq("school_id", sid)
    .order("name", { ascending: true });

  if (term) query = query.eq("term", term);
  const { data, error } = await query;
  throwIfError(error, "getFees");
  return (data ?? []) as Fee[];
}

export async function createFee(
  schoolId: string | null,
  data: Omit<Fee, "id" | "school_id" | "created_at" | "updated_at">
): Promise<Fee> {
  const sid = requireSchoolId(schoolId);
  const { data: row, error } = await db()
    .from("fees")
    .insert({ ...data, school_id: sid })
    .select()
    .single();
  throwIfError(error, "createFee");
  return row as Fee;
}

export async function updateFee(
  schoolId: string | null,
  feeId: string,
  updates: Partial<Omit<Fee, "id" | "school_id" | "created_at">>
): Promise<Fee> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("fees")
    .update(updates)
    .eq("id", feeId)
    .eq("school_id", sid)
    .select()
    .single();
  throwIfError(error, "updateFee");
  return data as Fee;
}

export async function deleteFee(
  schoolId: string | null,
  feeId: string
): Promise<void> {
  const sid = requireSchoolId(schoolId);
  const { error } = await db()
    .from("fees")
    .delete()
    .eq("id", feeId)
    .eq("school_id", sid);
  throwIfError(error, "deleteFee");
}

export async function getPayments(
  schoolId: string | null,
  filters?: { student_id?: string; status?: string }
): Promise<Payment[]> {
  const sid = requireSchoolId(schoolId);
  let query = db()
    .from("payments")
    .select("*")
    .eq("school_id", sid)
    .order("created_at", { ascending: false });

  if (filters?.student_id) query = query.eq("student_id", filters.student_id);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  throwIfError(error, "getPayments");
  return (data ?? []) as Payment[];
}

// ─── Teacher Portal Helpers ───────────────────────────────────────────

export async function getMyTeacherProfile(
  schoolId: string | null,
  authUserId: string
): Promise<Teacher | null> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("teachers")
    .select("*")
    .eq("school_id", sid)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  throwIfError(error, "getMyTeacherProfile");
  return data as Teacher | null;
}

export async function getStudentProfile(
  _schoolId: string | null,
  _authUserId: string
): Promise<Student | null> {
  // Students are not yet linked via auth_user_id in this schema.
  // Returns null so callers fall back to class-picker mode.
  return null;
}

export async function getTeacherClasses(
  schoolId: string | null,
  teacher: Teacher
): Promise<Class[]> {
  const sid = requireSchoolId(schoolId);

  // Classes where teacher is the assigned class teacher OR in their class_ids array
  const classTeacherIds: string[] = teacher.class_teacher_of ? [teacher.class_teacher_of] : [];
  const assignedIds: string[] = Array.isArray(teacher.class_ids) ? teacher.class_ids : [];
  const allIds = Array.from(new Set([...classTeacherIds, ...assignedIds]));

  // Also pull by class_teacher_id column
  const queries: Promise<Class[]>[] = [];

  // by class_teacher_id column
  queries.push(
    db()
      .from("classes")
      .select("*")
      .eq("school_id", sid)
      .eq("class_teacher_id", teacher.id)
      .then(({ data, error }: { data: Class[] | null; error: unknown }) => {
        throwIfError(error, "getTeacherClasses:class_teacher_id");
        return data ?? [];
      })
  );

  // by id list from teacher.class_ids
  if (allIds.length > 0) {
    queries.push(
      db()
        .from("classes")
        .select("*")
        .eq("school_id", sid)
        .in("id", allIds)
        .then(({ data, error }: { data: Class[] | null; error: unknown }) => {
          throwIfError(error, "getTeacherClasses:class_ids");
          return data ?? [];
        })
    );
  }

  const results = await Promise.all(queries);
  const merged = results.flat();
  // deduplicate by id
  const seen = new Set<string>();
  return merged.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

// ─── Timetable ────────────────────────────────────────────────────────

export interface TimetableSlot {
  id: string;
  school_id: string;
  class_id: string;
  class_name: string;
  academic_year: string;
  term: "first" | "second" | "third";
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
  period_number: number;
  period_type: "lesson" | "short_break" | "long_break" | "assembly" | "lunch" | "closing";
  start_time: string;
  end_time: string;
  subject_id: string | null;
  subject_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  room: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTimetable(
  schoolId: string | null,
  classId: string,
  term: string,
  academicYear: string
): Promise<TimetableSlot[]> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("timetable")
    .select("*")
    .eq("school_id", sid)
    .eq("class_id", classId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .order("day")
    .order("period_number");
  throwIfError(error, "getTimetable");
  return (data ?? []) as TimetableSlot[];
}

export async function getAllTimetableSlots(
  schoolId: string | null,
  term: string,
  academicYear: string
): Promise<TimetableSlot[]> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db()
    .from("timetable")
    .select("*")
    .eq("school_id", sid)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .order("class_name")
    .order("day")
    .order("period_number");
  throwIfError(error, "getAllTimetableSlots");
  return (data ?? []) as TimetableSlot[];
}

export async function saveTimetableSlot(
  schoolId: string | null,
  slot: Omit<TimetableSlot, "id" | "school_id" | "created_at" | "updated_at"> & { id?: string }
): Promise<TimetableSlot> {
  const sid = requireSchoolId(schoolId);
  const payload = { ...slot, school_id: sid };
  const { data, error } = await db()
    .from("timetable")
    .upsert(payload, { onConflict: "school_id,class_id,day,period_number,academic_year,term" })
    .select()
    .single();
  throwIfError(error, "saveTimetableSlot");
  return data as TimetableSlot;
}

export async function bulkSaveTimetable(
  schoolId: string | null,
  slots: (Omit<TimetableSlot, "id" | "school_id" | "created_at" | "updated_at"> & { id?: string })[]
): Promise<TimetableSlot[]> {
  const sid = requireSchoolId(schoolId);
  const payloads = slots.map((s) => ({ ...s, school_id: sid }));
  const { data, error } = await db()
    .from("timetable")
    .upsert(payloads, { onConflict: "school_id,class_id,day,period_number,academic_year,term" })
    .select();
  throwIfError(error, "bulkSaveTimetable");
  return (data ?? []) as TimetableSlot[];
}

export async function deleteTimetableSlot(
  schoolId: string | null,
  slotId: string
): Promise<void> {
  const sid = requireSchoolId(schoolId);
  const { error } = await db()
    .from("timetable")
    .delete()
    .eq("school_id", sid)
    .eq("id", slotId);
  throwIfError(error, "deleteTimetableSlot");
}

// ─── Attendance RPCs ───────────────────────────────────────────────────

export interface AttendanceSummaryRow {
  total_classes_with_attendance: number;
  total_present: number;
  total_absent: number;
  attendance_rate: number;
}

export interface AttendanceByClassRow {
  class_id: string;
  class_name: string;
  present_count: number;
  absent_count: number;
  taken_by_name: string;
  taken_at: string;
}

export async function getTodayAttendanceSummary(
  schoolId: string | null
): Promise<AttendanceSummaryRow | null> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db().rpc("get_today_attendance_summary", { p_school_id: sid });
  throwIfError(error, "getTodayAttendanceSummary");
  return (data?.[0] ?? null) as AttendanceSummaryRow | null;
}

export async function getTodayAttendanceByClass(
  schoolId: string | null
): Promise<AttendanceByClassRow[]> {
  const sid = requireSchoolId(schoolId);
  const { data, error } = await db().rpc("get_today_attendance_by_class", { p_school_id: sid });
  throwIfError(error, "getTodayAttendanceByClass");
  return (data ?? []) as AttendanceByClassRow[];
}

// ─── Activity Logs ────────────────────────────────────────────────────

export async function getRecentActivity(
  tenantId: string | null,
  limit = 10
): Promise<{ id: number; staff_id: string; action: string; details: string | null; timestamp: string }[]> {
  if (!tenantId) return [];
  const { data, error } = await supabase.rpc("get_tenant_activity_logs", {
    _tenant_id: tenantId,
    _limit: limit,
  });
  throwIfError(error, "getRecentActivity");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []) as any as { id: number; staff_id: string; action: string; details: string | null; timestamp: string }[];
}

// ─── Tenant Management (SuperAdmin) ───────────────────────────────────

export interface Tenant {
  id: string;
  tenant_code: string;
  school_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: "trial" | "active" | "expired" | "suspended";
  plan: "trial" | "termly" | "yearly";
  trial_started_at: string | null;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  notes: string | null;
  created_at: string;
}

export async function getAllTenants(): Promise<Tenant[]> {
  const { data, error } = await from("tenants")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(error, "getAllTenants");
  return (data ?? []) as Tenant[];
}

export async function updateTenantStatus(
  tenantId: string,
  status: Tenant["status"]
): Promise<void> {
  const { error } = await from("tenants")
    .update({ status })
    .eq("id", tenantId);
  throwIfError(error, "updateTenantStatus");
}

export async function resetTenantAdminPin(tenantId: string): Promise<void> {
  const { error } = await from("tenants")
    .update({ admin_pin_hash: null })
    .eq("id", tenantId);
  throwIfError(error, "resetTenantAdminPin");
}

export async function resetSchoolPin(tenantId: string, newPin: string): Promise<void> {
  const { error } = await supabase.rpc("reset_school_pin", {
    _tenant_id: tenantId,
    _new_pin: newPin,
  });
  throwIfError(error, "resetSchoolPin");
}

export async function createTenantV2(
  params: {
    schoolName: string;
    schoolPin: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    startTrial?: boolean;
  }
): Promise<void> {
  const { error } = await supabase.rpc("create_tenant_v2", {
    _school_name: params.schoolName,
    _school_pin: params.schoolPin,
    _contact_email: params.contactEmail || null,
    _contact_phone: params.contactPhone || null,
    _notes: params.notes || null,
    _start_trial: params.startTrial ?? true,
  });
  throwIfError(error, "createTenantV2");
}

export async function checkUserRole(
  userId: string,
  role: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });
  if (error) return false;
  return data === true;
}

export async function findDuplicateTenants(): Promise<unknown[]> {
  const { data, error } = await supabase.rpc("find_duplicate_tenants");
  throwIfError(error, "findDuplicateTenants");
  return (data ?? []) as unknown[];
}

export async function suspendDuplicateTenant(
  tenantId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc("suspend_duplicate_tenant" as never, {
    _tenant_id: tenantId,
    _reason: reason,
  } as never);
  throwIfError(error, "suspendDuplicateTenant");
}

export async function runSecurityRegressionCheck(): Promise<unknown> {
  const { data, error } = await supabase.rpc("security_regression_check" as never);
  throwIfError(error, "runSecurityRegressionCheck");
  return data;
}

// ─── SuperAdmin Audit Tables ──────────────────────────────────────────

export async function getTokenAuditEntries(
  limit = 100
): Promise<unknown[]> {
  const { data, error } = await from("super_admin_token_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error, "getTokenAuditEntries");
  return (data ?? []) as unknown[];
}

export async function getTenantAuthAuditEntries(
  limit = 100
): Promise<unknown[]> {
  const { data, error } = await from("tenant_auth_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error, "getTenantAuthAuditEntries");
  return (data ?? []) as unknown[];
}

// ─── Subscription Payments ────────────────────────────────────────────

export interface SubscriptionPayment {
  id: string;
  tenant_id: string;
  amount: number;
  plan: "trial" | "termly" | "yearly";
  period_start: string;
  period_end: string;
  reference: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export async function recordSubscriptionPayment(
  payment: Omit<SubscriptionPayment, "id" | "created_at">
): Promise<SubscriptionPayment> {
  const { data, error } = await from("subscription_payments")
    .insert(payment)
    .select()
    .single();
  throwIfError(error, "recordSubscriptionPayment");
  return data as SubscriptionPayment;
}

export async function updateTenantSubscription(
  tenantId: string,
  updates: {
    status: "trial" | "active" | "expired" | "suspended";
    plan: "trial" | "termly" | "yearly";
    subscription_starts_at: string;
    subscription_ends_at: string;
  }
): Promise<void> {
  const { error } = await from("tenants")
    .update(updates)
    .eq("id", tenantId);
  throwIfError(error, "updateTenantSubscription");
}

// ─── User Profile ────────────────────────────────────────────────────

export async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return data?.role ?? null;
}

export async function getUserProfile(userId: string): Promise<{
  role: string;
  school_id: string | null;
  first_name: string | null;
  last_name: string | null;
} | null> {
  const { data, error } = await from("profiles")
    .select("role, school_id, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return data as {
    role: string;
    school_id: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

// ─── Billing ─────────────────────────────────────────────────────────

export interface BillingRow {
  id: string;
  school_id: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  school_name?: string;
}

export async function getBillingRows(): Promise<BillingRow[]> {
  const { data, error } = await from("billing")
    .select("id,school_id,plan,status,trial_ends_at,current_period_end,created_at,schools(name)")
    .order("created_at", { ascending: false });
  throwIfError(error, "getBillingRows");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({ ...r, school_name: r.schools?.name })) as BillingRow[];
}

// ─── School Management (SuperAdmin) ───────────────────────────────────

export interface SchoolSummary {
  id: string;
  name: string;
  code: string;
  email: string | null;
  current_students: number;
  max_students: number;
  features: Record<string, boolean>;
  academic_year: string;
  current_term: string;
  created_at: string;
  status: string;
}

export async function getSchoolsList(): Promise<SchoolSummary[]> {
  const { data, error } = await from("schools")
    .select("id,name,code,email,current_students,max_students,features,academic_year,current_term,created_at,status")
    .order("created_at", { ascending: false });
  throwIfError(error, "getSchoolsList");
  return (data ?? []) as SchoolSummary[];
}

export async function updateSchoolStatus(
  schoolId: string,
  status: "active" | "suspended"
): Promise<void> {
  const { error } = await from("schools")
    .update({ status })
    .eq("id", schoolId);
  throwIfError(error, "updateSchoolStatus");
}

export async function getSchoolDetail(schoolId: string): Promise<unknown> {
  const { data, error } = await from("schools")
    .select("*")
    .eq("id", schoolId)
    .single();
  throwIfError(error, "getSchoolDetail");
  return data;
}

export async function getSchoolBilling(schoolId: string): Promise<unknown> {
  const { data, error } = await from("billing")
    .select("plan,status,trial_ends_at,current_period_start,current_period_end")
    .eq("school_id", schoolId)
    .maybeSingle();
  throwIfError(error, "getSchoolBilling");
  return data;
}

export async function updateSchoolFeatures(
  schoolId: string,
  features: Record<string, boolean>,
  maxStudents: number
): Promise<void> {
  const { error } = await from("schools")
    .update({ features, max_students })
    .eq("id", schoolId);
  throwIfError(error, "updateSchoolFeatures");
}

export async function updateBillingPlan(
  schoolId: string,
  plan: string
): Promise<void> {
  const { error } = await from("billing")
    .update({ plan })
    .eq("school_id", schoolId);
  throwIfError(error, "updateBillingPlan");
}

export async function getActivityLogs(
  schoolId?: string,
  limit = 50
): Promise<unknown[]> {
  let query = from("activity_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  
  if (schoolId) {
    query = query.eq("school_id", schoolId);
  }
  
  const { data, error } = await query.limit(limit);
  throwIfError(error, "getActivityLogs");
  return (data ?? []) as unknown[];
}

export async function getSchoolsForFilter(): Promise<unknown[]> {
  const { data, error } = await from("schools")
    .select("id,name")
    .order("name");
  throwIfError(error, "getSchoolsForFilter");
  return (data ?? []) as unknown[];
}

// ─── Edge Functions ───────────────────────────────────────────────────

export async function provisionSchool(params: {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address: { street: string; city: string; state: string };
  adminEmail?: string;
  adminName?: string;
  plan: string;
  tenantId: string;
}): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("provision-school", {
    body: params,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Students ────────────────────────────────────────────────────────

export async function getStudentsPaginated(
  schoolId: string,
  from: number,
  to: number
): Promise<{ data: unknown[]; count: number }> {
  const query = from("students")
    .select("*", { count: "exact" })
    .eq("school_id", schoolId)
    .order("name", { ascending: true })
    .range(from, to);
  
  const { data, error, count } = await query;
  throwIfError(error, "getStudentsPaginated");
  return { data: (data ?? []) as unknown[], count: count ?? 0 };
}

// ─── Session Logs ────────────────────────────────────────────────────

export async function getSessionLogs(
  superadmin: boolean,
  limit = 50
): Promise<unknown[]> {
  const { data, error } = await from("session_logs")
    .select(superadmin ? "*, schools(name)" : "*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error, "getSessionLogs");
  return (data ?? []) as unknown[];
}

export async function insertSessionLog(log: {
  user_id: string;
  school_id: string | null;
  user_name: string;
  event_type: string;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await from("session_logs").insert(log);
  throwIfError(error, "insertSessionLog");
}

// ─── Report Cards ───────────────────────────────────────────────────

export async function getSchoolByTenantId(tenantId: string): Promise<unknown> {
  const { data, error } = await from("schools")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  throwIfError(error, "getSchoolByTenantId");
  return data;
}

export async function getStudentByEmail(
  schoolId: string,
  email: string
): Promise<unknown> {
  const { data, error } = await from("students")
    .select("id, guardian_email")
    .eq("school_id", schoolId)
    .eq("guardian_email", email)
    .maybeSingle();
  throwIfError(error, "getStudentByEmail");
  return data;
}

export async function updateStudentGuardianEmail(
  studentId: string,
  email: string
): Promise<void> {
  const { error } = await from("students")
    .update({ guardian_email: email })
    .eq("id", studentId);
  throwIfError(error, "updateStudentGuardianEmail");
}

export async function insertStudent(student: {
  school_id: string;
  name: string;
  guardian_email: string;
}): Promise<unknown> {
  const { data, error } = await from("students")
    .insert(student)
    .select("id")
    .single();
  throwIfError(error, "insertStudent");
  return data;
}

export async function upsertReportCard(
  payload: Record<string, unknown>,
  conflictColumns: string[]
): Promise<unknown> {
  const { data, error } = await from("report_cards")
    .upsert(payload, {
      onConflict: conflictColumns.join(","),
    });
  throwIfError(error, "upsertReportCard");
  return data;
}

export async function getReportCard(
  schoolId: string,
  studentId: string | null,
  term: string,
  academicYear: string
): Promise<unknown> {
  const { data, error } = await from("report_cards")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .maybeSingle();
  throwIfError(error, "getReportCard");
  return data;
}

export async function updateReportCard(
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await from("report_cards")
    .update(payload)
    .eq("id", id);
  throwIfError(error, "updateReportCard");
}

export async function insertReportCard(
  payload: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await from("report_cards")
    .insert(payload)
    .select("id")
    .single();
  throwIfError(error, "insertReportCard");
  return data;
}

// ─── Payments Edge Function ───────────────────────────────────────────

export async function initiatePayment(params: {
  studentId: string;
  feeId: string;
  amount: number;
}): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("initiate-payment", {
    body: params,
  });
  if (error) throw new Error(error.message);
  return data;
}
