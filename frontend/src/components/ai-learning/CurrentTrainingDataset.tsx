import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "../ui/card";
import { TrainingDatasetItem } from "./TrainingDatasetItem";
import { aiLearningApi, type TrainingExampleItem } from "../../services/api";
import { useLanguage } from "../../context/useLanguage";
interface CurrentTrainingDatasetProps {
  refreshKey?: number;
}

export function CurrentTrainingDataset({ refreshKey = 0 }: CurrentTrainingDatasetProps) {
  const { t } = useLanguage();
  const [items, setItems] = useState<TrainingExampleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
    });

    aiLearningApi
      .listExamples()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <Card className="border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-6 text-lg font-bold text-black dark:text-white">
        {t("currentTrainingDataset")}
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">
            {t("loadingTrainingDataset")}
          </span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {t("noTrainingExamples")}
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            {t("uploadExamplesHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <TrainingDatasetItem
              key={item.id}
              fileName={item.fileName}
              id={item.id}
              uploadDate={item.uploadDate}
              type={item.type}
              status={item.status}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
