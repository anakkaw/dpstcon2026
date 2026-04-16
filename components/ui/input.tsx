import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-ink",
          "placeholder:text-gray-400",
          "transition-[background-color,border-color,color,box-shadow] duration-200",
          "hover:border-gray-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:border-brand-500",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50",
          error || props["aria-invalid"]
            ? "border-red-300 focus-visible:ring-red-500/30 focus-visible:border-red-500"
            : "border-gray-200",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
