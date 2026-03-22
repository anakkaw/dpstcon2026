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
          "transition-all duration-200",
          "hover:border-gray-300",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50",
          error
            ? "border-red-300 focus:ring-red-500/30 focus:border-red-500"
            : "border-gray-200",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
