import { Card } from "../ui/card";
import { useLanguage } from "../../context/useLanguage";

export function TrainingDataGuidelines() {
  const { t } = useLanguage();

  const guidelines = [
    t("guideline1"),
    t("guideline2"),
    t("guideline3"),
    t("guideline4"),
  ];

  return (
    <Card className="border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-bold text-black dark:text-white">
        {t("trainingDataGuidelines")}
      </h3>

      <ul className="space-y-3">
        {guidelines.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-600 dark:bg-gray-400" />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}