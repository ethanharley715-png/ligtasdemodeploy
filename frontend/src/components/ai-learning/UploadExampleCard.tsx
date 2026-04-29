import type { LucideIcon } from "lucide-react";
import { Upload } from "lucide-react";
import { Card } from "../ui/card";

interface UploadExampleCardProps {
  variant: "good" | "bad";
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel: string;
  exampleText: string;
  onUpload?: () => void;
}

export function UploadExampleCard({
  variant,
  icon: Icon,
  title,
  description,
  buttonLabel,
  exampleText,
  onUpload,
}: UploadExampleCardProps) {
  const isGood = variant === "good";
  const accentClasses = isGood
    ? {
        badge: "bg-green-100 dark:bg-green-500/15",
        icon: "text-green-500 dark:text-green-300",
      }
    : {
        badge: "bg-red-100 dark:bg-red-500/15",
        icon: "text-red-500 dark:text-red-300",
      };

  return (
    <Card className="flex flex-col items-center border-2 border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className={`mb-5 rounded-full p-4 ${accentClasses.badge}`}>
        <Icon className={`size-10 ${accentClasses.icon}`} />
      </div>

      <h3 className="mb-3 text-xl font-bold text-slate-950 dark:text-slate-50">{title}</h3>

      <p className="mb-6 max-w-md text-slate-600 dark:text-slate-300">{description}</p>

      <button
        type="button"
        onClick={onUpload}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
      >
        <Upload className="size-5" />
        {buttonLabel}
      </button>

      <p className="mt-4 text-sm italic text-slate-500 dark:text-slate-300">{exampleText}</p>
    </Card>
  );
}
