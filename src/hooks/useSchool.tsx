import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSchoolProfile, School } from "@/supabase/schoolService";

interface SchoolContextValue {
  school: School | null;
  setSchool: React.Dispatch<React.SetStateAction<School | null>>;
  loading: boolean;
  error: string | null;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const { schoolId } = useAuth();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) {
      setSchool(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSchoolProfile(schoolId)
      .then((s) => {
        setSchool(s);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  return (
    <SchoolContext.Provider value={{ school, setSchool, loading, error }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) {
    throw new Error("useSchool must be used inside <SchoolProvider>");
  }
  return ctx;
}
