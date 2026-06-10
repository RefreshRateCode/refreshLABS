import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-content">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-faint">{hint}</span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-content placeholder:text-faint focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />
  );
}

const badgeColors: Record<string, string> = {
  draft: "bg-neutral-500/15 text-content",
  sent: "bg-brand/15 text-brand",
  partial: "bg-amber-500/15 text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  overdue: "bg-red-500/15 text-red-300",
  void: "bg-neutral-600/20 text-faint line-through",
  unpaid: "bg-amber-500/15 text-amber-300",
  // project statuses
  active: "bg-brand/15 text-brand",
  on_hold: "bg-amber-500/15 text-amber-300",
  done: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-neutral-600/20 text-faint line-through",
};

export function Badge({ status }: { status: string }) {
  const cls = badgeColors[status] ?? "bg-neutral-500/15 text-content";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50";
  const variants = {
    primary: "bg-brand text-black hover:bg-brand-light",
    secondary:
      "border border-line bg-surface text-content hover:bg-surface2",
    danger: "bg-red-600 text-white hover:bg-red-500",
    ghost: "text-muted hover:bg-surface2",
  };
  return (
    <button {...props} className={`${base} ${variants[variant]} ${className}`} />
  );
}
