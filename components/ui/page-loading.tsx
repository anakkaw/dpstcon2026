interface PageLoadingProps {
  label: string;
  description: string;
}

export function PageLoading({ label, description }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
