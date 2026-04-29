import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useLanguage } from "../../context/useLanguage";
import type { TranslationKey } from "../../i18n/translations";

interface TrainingDatasetItemProps {
  fileName: string;
  id: string;
  uploadDate: string;
  type: "good" | "bad";
  status: string;
}

export function TrainingDatasetItem({
  fileName,
  id,
  uploadDate,
  type,
  status,
}: TrainingDatasetItemProps) {
  const { t } = useLanguage();
  const isGood = type === "good";

  return (
    <div className="flex items-center justify-between rounded-xl border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-4">
        <div
          className={`rounded-full p-2.5 ${
            isGood ? "bg-green-100" : "bg-red-100"
          }`}
        >
          {isGood ? (
            <ThumbsUp className="size-5 text-green-500" />
          ) : (
            <ThumbsDown className="size-5 text-red-500" />
          )}
        </div>

        <div>
          <p className="font-semibold text-black dark:text-white">{fileName}</p>

          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{id}</span>
            <span>
              {t("uploaded")}: {uploadDate}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            isGood
              ? "border-green-600 text-green-600"
              : "border-red-500 text-red-500"
          }`}
        >
          {isGood ? t("good") : t("bad")}
        </span>

        <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
          {t(status as TranslationKey)}
        </span>
      </div>
    </div>
  );
}
