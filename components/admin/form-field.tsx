import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface FieldControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

/**
 * Labelled form field: visible <label htmlFor>, optional hint, and error text
 * below the control wired through aria-invalid and aria-describedby.
 */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type FieldErrors = Record<string, string>;

/** Maps a single server error message onto a field using regex hints. */
export function mapServerError(message: string, hints: [RegExp, string][]): FieldErrors {
  for (const [pattern, field] of hints) {
    if (pattern.test(message)) return { [field]: message };
  }
  return {};
}

export const controlClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50";

export function StatusMessage({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p role="status" className="rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
        {ok}
      </p>
    );
  }
  return <p role="status" className="sr-only" />;
}
