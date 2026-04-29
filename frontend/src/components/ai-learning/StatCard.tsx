import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/card";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  footer: React.ReactNode;
  valueClassName?: string;
}

export function StatCard({ label, value, icon: Icon, footer, valueClassName }: StatCardProps) {
  return (
    <Card className="border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="mb-1 text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</p>
          <p className={`font-bold text-black dark:text-white ${valueClassName ?? "text-4xl"}`}>{value}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-700/90">
          <Icon className="size-6 text-slate-800 dark:text-slate-100" />
        </div>
      </div>
      <div className="text-sm">{footer}</div>
    </Card>
  );
}
