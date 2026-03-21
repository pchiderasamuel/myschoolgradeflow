import { memo } from "react";
import { Check, X, AlertTriangle } from "lucide-react";

interface ToastProps {
  toast: { msg: string; type: string; id: string };
}

const AppToast = memo(({ toast }: ToastProps) => {
  const styles: Record<string, string> = {
    success: "bg-foreground text-background",
    error: "bg-destructive text-destructive-foreground",
    warning: "bg-warning text-warning-foreground",
  };

  const icons: Record<string, React.ReactNode> = {
    success: <Check className="w-4 h-4" />,
    error: <X className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] flex justify-center animate-slide-up pointer-events-none">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg ${styles[toast.type] || styles.success}`}>
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          {icons[toast.type] || icons.success}
        </div>
        <span className="text-sm font-semibold">{toast.msg}</span>
      </div>
    </div>
  );
});

AppToast.displayName = "AppToast";
export default AppToast;
