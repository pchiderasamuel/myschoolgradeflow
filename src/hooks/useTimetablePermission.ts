import { useAuth, AppRole } from "@/contexts/AuthContext";

/**
 * Roles allowed to edit timetable data.
 * To grant a new role edit access, simply add it to this array.
 */
const TIMETABLE_EDIT_ROLES: AppRole[] = [
  "super_admin",
  "school_admin",
  "principal",
  "head_teacher",
  "authorised_staff",
];

/**
 * Hook that checks whether the currently logged-in user
 * has permission to edit the timetable.
 *
 * Uses the role already resolved by AuthContext (from the
 * `profiles` table / `user_roles` RPC), so no extra query
 * is fired.
 *
 * @returns
 *  - `canEditTimetable` – true when the user's role is in TIMETABLE_EDIT_ROLES
 *  - `isLoadingRole`    – true while AuthContext is still resolving the session
 *  - `userRole`         – the resolved role string (or null)
 */
export function useTimetablePermission() {
  const { role, loading } = useAuth();

  const canEditTimetable: boolean =
    !loading && role !== null && TIMETABLE_EDIT_ROLES.includes(role);

  return {
    canEditTimetable,
    isLoadingRole: loading,
    userRole: role,
  } as const;
}
