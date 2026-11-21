"use client";

export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 z-[9999] -translate-x-1/2 rounded-[20px] bg-[var(--text)] px-5 py-2.5 text-sm font-semibold text-[var(--bg)] shadow-lg"
      onClick={onDismiss}
    >
      {message}
    </div>
  );
}
