
# /app PIN → Supabase Auth Bridge

Goal: keep `/app` as the single PIN-driven entrance, but after PIN verification sign the user into Supabase with a real role/school_id so we can mount the existing `/school` admin pages (including the full `TimetablePage`) directly inside `/app`. No changes to `/school`, `/auth`, or super admin flows.

## Open gaps to resolve first

The current PIN system has only two PINs per tenant (`school_pin`, `admin_pin`). It also has no link to the `schools` table. Before we can do "Admin / Teacher / Student PIN" views, we need:

1. **Tenant ↔ School mapping.** Either add `schools.tenant_id` (nullable, unique) or `tenants.school_id`. Without this we can't grant the bridged auth user `profiles.school_id`.
2. **Teacher PIN and Student PIN.** These don't exist today. Options:
   - (A) Reuse the existing `teachers.employee_id` + a new `teacher_pin_hash` column, and `students.admission_no` + a new `student_pin_hash` column. PIN entry collects `(school_pin, employee_id/admission_no, personal_pin)`.
   - (B) Keep admin-only bridge for now; defer teacher/student PINs.

I'll assume **(A)** for the full plan but will ask once more before writing the migration.

## Phase 1 — Schema changes (one migration)

- `ALTER TABLE schools ADD COLUMN tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE SET NULL`
- `ALTER TABLE teachers ADD COLUMN pin_hash TEXT` (bcrypt)
- `ALTER TABLE students ADD COLUMN pin_hash TEXT` (bcrypt)
- New table `pin_sessions(token TEXT PK, tenant_id UUID, school_id UUID, subject_kind TEXT CHECK IN ('admin','teacher','student'), subject_id UUID, auth_user_id UUID, expires_at TIMESTAMPTZ default now() + interval '8 hours')`. RLS: deny all client access; only SECURITY DEFINER RPCs read/write.
- New SECURITY DEFINER RPCs (called from the browser, no auth):
  - `bridge_admin_pin(_school_pin, _admin_pin)` → verifies both, mints a one-time `bridge_token` row.
  - `bridge_teacher_pin(_school_pin, _employee_id, _teacher_pin)` → same.
  - `bridge_student_pin(_school_pin, _admission_no, _student_pin)` → same.
  - All also INSERT into `session_logs` with action `LOGIN`, `role`, `school_id`, `device` provided by caller. (Loosen the `session_logs_insert` RLS to allow these via SECURITY DEFINER, not via direct client insert.)
- An edge function `bridge-pin-login` that:
  1. Accepts the one-time `bridge_token`.
  2. Looks up the matching pin_session row server-side using SERVICE_ROLE.
  3. Creates a Supabase anonymous user (or signs in to a pre-provisioned per-subject auth user if it already exists).
  4. Upserts `profiles` for that auth user with `role` ∈ {`school_admin`,`teacher`,`student`} and `school_id`.
  5. For teacher/student: sets `teachers.auth_user_id` / `students.auth_user_id` if blank.
  6. Returns the Supabase session tokens to the browser.
- CHECK constraint on `timetable.period_type` — already done in the last migration.
- LOGOUT: a tiny RPC `pin_logout()` that inserts a `LOGOUT` row into `session_logs` and revokes the matching `pin_sessions` row, called from the existing `/app` sign-out button.

## Phase 2 — Frontend wiring

- `/app` PIN screen:
  - Admin tab: school PIN + admin PIN (current flow).
  - Teacher tab: school PIN + employee ID + personal PIN.
  - Student tab: school PIN + admission number + personal PIN.
- After a successful bridge:
  - Call `supabase.auth.setSession()` with the tokens from the edge function.
  - Replace the current `TenantApp` body with a thin `<AppShell>` that decides which page tree to render based on `profiles.role`:
    - `school_admin` → reuse the `/school` route tree (Dashboard, Students, Classes, **TimetablePage**, Results, Attendance, Reports, Settings).
    - `teacher` → reuse `/teacher` page tree (read-only timetable, take attendance, enter scores).
    - `student` → reuse `/student` page tree (timetable, my results, my attendance).
- Keep the legacy localStorage `School_Management_App` only as a fallback for tenants without a linked `schools` row (so existing PIN tenants don't break before they're migrated).
- Auto-logout after 8h: a `useEffect` watcher on `pin_sessions.expires_at` that signs out + calls `pin_logout()`.

## Phase 3 — Untouched

- `/school`, `/teacher`, `/student` routes keep their email-auth entrance unchanged.
- `/auth` is unchanged. No redirect from `/auth` → `/app`.
- `/superadmin` is unchanged.

## Risks / things I want to confirm before I start writing it

1. **Anonymous auth users**: this approach creates one Supabase user per PIN login (or one per teacher/student). Acceptable, or do you want one durable auth user per teacher/student (provisioned at staff/student creation time)?
2. **PINs**: confirm option (A) — add `teachers.pin_hash` and `students.pin_hash`, with the school admin setting/resetting PINs from the admin UI.
3. **Tenant→School link**: confirm we can add `schools.tenant_id` and that you'll populate it for existing tenants (or I can write a one-shot mapping script if you tell me the rule).

If you say yes to all three I'll ship Phase 1 (migration + edge function) in the next turn, then Phase 2 in a follow-up.
