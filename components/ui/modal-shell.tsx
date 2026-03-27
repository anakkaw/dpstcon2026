"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  hideCloseButton?: boolean;
}

export function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
  bodyClassName,
  hideCloseButton = false,
}: ModalShellProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-shell-title"
        className={cn("w-full max-w-lg rounded-2xl border border-border bg-surface shadow-xl", className)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3 id="modal-shell-title" className="text-base font-semibold text-ink">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            ) : null}
          </div>
          {!hideCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-gray-100 hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        {children != null ? (
          <div className={cn("max-h-[60vh] overflow-y-auto px-6 py-5", bodyClassName)}>
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="rounded-b-2xl border-t border-border bg-surface-alt px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
