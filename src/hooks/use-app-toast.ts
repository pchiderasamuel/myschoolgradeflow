import { useState, useCallback, useEffect, useRef } from "react";

export function useToastHook() {
  const [toast, setToast] = useState<{ msg: string; type: string; id: string } | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string, type: "success" | "error" | "warning" = "success") => {
    clearTimeout(t.current);
    setToast({ msg, type, id: Date.now().toString() });
    t.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => clearTimeout(t.current), []);

  return { toast, showToast };
}
