import { useState, useCallback } from "react";
import { StatsOverview } from "../ai-learning/StatsOverview";
import { HowAILearningWorks } from "../ai-learning/HowAILearningWorks";
import { TrainingTabs } from "../ai-learning/TrainingTabs";
import { TrainingDataGuidelines } from "../ai-learning/TrainingDataGuidelines";
import { SatisfactionTrendChart } from "../ai-learning/satisfationTrendChart";
import { SatisfactionDistributionChart } from "../ai-learning/satisfactionDistributionChart";
import { useLanguage } from "../../context/useLanguage";

export function AILearningView() {
  const { t } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);

  const onDataChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-full p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold text-black dark:text-white">{t("aiLearningTraining")}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          {t("aiLearningTrainingDescription")}
        </p>
      </div>

      <StatsOverview refreshKey={refreshKey} />

      <div className="mt-6">
        <HowAILearningWorks />
      </div>

      <div className="mt-6">
        <TrainingTabs refreshKey={refreshKey} onDataChanged={onDataChanged} />
      </div>

      <div className="mt-6">
        <TrainingDataGuidelines />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <SatisfactionTrendChart />
        <SatisfactionDistributionChart />
      </div>

      <p className="mt-4 text-center">
        {t("aiLearningFeedbackSummary")}
      </p>
    </div>
  );
}