import { ReactNode } from "react";

interface BottomSheetProps {
  children: ReactNode;
  onClose: () => void;
}

export default function BottomSheet({ children, onClose }: BottomSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden animate-slide-up shadow-2xl">
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 sm:hidden" />
        {children}
      </div>
    </div>
  );
}
