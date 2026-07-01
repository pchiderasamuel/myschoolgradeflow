import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, ClipboardCheck, BarChart2, UserCircle, CalendarClock, Menu, X, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { logAuthEvent } from "@/lib/auth-logger";

const NAV = [
  { to: "/teacher/classes",    label: "My Classes",  icon: BookOpen },
  { to: "/teacher/attendance", label: "Attendance",  icon: ClipboardCheck },
  { to: "/teacher/results",    label: "Results",     icon: BarChart2 },
  { to: "/teacher/timetable",  label: "Timetable",   icon: CalendarClock },
  { to: "/teacher/resources",  label: "Resources",   icon: BookOpen },
  { to: "/teacher/profile",    label: "Profile",     icon: UserCircle },
  { to: "/teacher/settings",   label: "Settings",    icon: Settings },
];

export default function TeacherLayout({ schoolName, logoUrl }: { schoolName?: string; logoUrl?: string; }) {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const slug = localStorage.getItem("schoolapp_school_slug");
    if (profile) {
      await logAuthEvent({
        authType: "staff",
        eventType: "logout",
        userId: profile.userId,
        userName: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.email || "Teacher",
        role: profile.role,
        schoolId: profile.schoolId || undefined,
      });
    }
    await signOut();
    navigate(slug ? `/app/${slug}/login` : "/", { replace: true });
  };

  const initials = [profile?.firstName, profile?.lastName]
    .filter(Boolean).map((s) => s![0].toUpperCase()).join("")
    || profile?.email?.[0]?.toUpperCase() || "?";

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <aside className={cn(
      "flex flex-col bg-indigo-900 text-white",
      mobile ? "fixed inset-y-0 left-0 z-50 w-60" : "hidden lg:flex w-60 min-h-screen"
    )}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-700">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded object-cover bg-white shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded bg-indigo-800 flex items-center justify-center text-indigo-300 font-bold text-lg shrink-0">
              {schoolName ? schoolName[0].toUpperCase() : "T"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-indigo-300 font-medium uppercase tracking-wider truncate">Teacher Portal</p>
            <p className="text-sm font-semibold text-white truncate max-w-[140px]">{schoolName ?? "—"}</p>
          </div>
        </div>
        {mobile && (
          <button onClick={() => setOpen(false)} className="text-indigo-300 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => mobile && setOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-indigo-700 text-white" : "text-indigo-300 hover:bg-indigo-800 hover:text-white"
            )}
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarContent />

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
          <SidebarContent mobile />
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 ml-auto">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-indigo-700 text-white text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium text-slate-700">
                  {profile?.firstName
                    ? `${profile.firstName} ${profile.lastName ?? ""}`.trim()
                    : profile?.email ?? "Teacher"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled className="text-xs text-slate-500">{profile?.email}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onClick={handleSignOut}>
                <LogOut size={14} className="mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
