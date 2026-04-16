import { cloneElement, isValidElement, useId } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  const autoId = useId();
  const hintId = `${autoId}-hint`;
  const errorId = `${autoId}-error`;

  const describedBy = [
    hint && !error ? hintId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  // Inject aria attributes into the first child element
  const enhancedChildren =
    isValidElement<Record<string, unknown>>(children)
      ? cloneElement(children, {
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
        })
      : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink"
      >
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {enhancedChildren}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-muted leading-relaxed">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger font-medium" role="alert">{error}</p>
      )}
    </div>
  );
}
