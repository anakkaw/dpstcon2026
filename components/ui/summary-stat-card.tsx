import { cn } from "@/lib/utils";

interface SummaryStatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: "blue" | "indigo" | "violet" | "emerald" | "red" | "gray" | "amber";
  className?: string;
}

const styles = {
  blue: {
    card: "from-blue-50 to-indigo-50 border-blue-100",
    text: "text-blue-700",
    icon: "text-blue-400",
  },
  indigo: {
    card: "from-indigo-50 to-violet-50 border-indigo-100",
    text: "text-indigo-700",
    icon: "text-indigo-400",
  },
  violet: {
    card: "from-violet-50 to-fuchsia-50 border-violet-100",
    text: "text-violet-700",
    icon: "text-violet-400",
  },
  emerald: {
    card: "from-emerald-50 to-green-50 border-emerald-100",
    text: "text-emerald-700",
    icon: "text-emerald-400",
  },
  red: {
    card: "from-red-50 to-rose-50 border-red-100",
    text: "text-red-700",
    icon: "text-red-400",
  },
  gray: {
    card: "from-slate-50 to-gray-100 border-slate-200",
    text: "text-slate-700",
    icon: "text-slate-400",
  },
  amber: {
    card: "from-amber-50 to-orange-50 border-amber-100",
    text: "text-amber-700",
    icon: "text-amber-400",
  },
} as const;

export function SummaryStatCard({
  label,
  value,
  icon,
  color = "blue",
  className,
}: SummaryStatCardProps) {
  const tone = styles[color];

  return (
    <div className={cn(`rounded-xl border bg-gradient-to-br px-4 py-3 ${tone.card}`, className)}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className={`text-2xl font-bold ${tone.text}`}>{value}</p>
        {icon ? <div className={tone.icon}>{icon}</div> : null}
      </div>
      <p className={`text-xs font-medium ${tone.text} opacity-70`}>{label}</p>
    </div>
  );
}
