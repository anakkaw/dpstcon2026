import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-ink",
          "placeholder:text-gray-400",
          "transition-all duration-200 resize-y min-h-[80px]",
          "hover:border-gray-300",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50",
          error || props["aria-invalid"] ? "border-red-300 focus:ring-red-500/30 focus:border-red-500" : "border-gray-200",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
