"use client";
// components/Switch.tsx — interruptor on/off.

export default function Switch({
  activo,
  onChange,
  disabled,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        activo ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          activo ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
