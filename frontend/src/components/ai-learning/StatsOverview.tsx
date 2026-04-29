import { useEffect, useState } from "react";
import {
  Brain,
  BookOpen,
  CheckCircle,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { aiLearningApi, type AILearningStats } from "../../services/api";
import { useLanguage } from "../../context/useLanguage";
import type { TranslationKey } from "../../i18n/translations";

function formatRelativeDate(
  isoDate: string | null,
  t: (key: TranslationKey) => string,
): string {
  if (!isoDate) return t("never");

  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return t("today");
  if (days === 1) return t("oneDayAgo");
  return `${days} ${t("daysAgo")}`;
}

interface StatsOverviewProps {
  refreshKey?: number;
}

export function StatsOverview({ refreshKey = 0 }: StatsOverviewProps) {
  const { t } = useLanguage();
  const [stats, setStats] = useState<AILearningStats | null>(null);

  useEffect(() => {
    aiLearningApi.stats().then(setStats).catch(console.error);
  }, [refreshKey]);

  const modelAccuracy = stats?.modelAccuracy ?? 87.3;
  const accuracyChange = stats?.accuracyChange ?? 3.2;
  const totalExamples = stats?.totalExamples ?? 0;
  const goodExamples = stats?.goodExamples ?? 0;
  const badExamples = stats?.badExamples ?? 0;
  const lastTraining = stats ? formatRelativeDate(stats.lastTrainingDate, t) : "—";
  const feedbackCount = stats?.feedbackReceivedThisMonth ?? 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("modelAccuracy")}
        value={`${modelAccuracy}%`}
        icon={Brain}
        footer={
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-slate-800 dark:text-slate-200" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">+{accuracyChange}%</span>
            <span className="text-gray-500 dark:text-gray-400">{t("thisMonth")}</span>
          </div>
        }
      />

      <StatCard
        label={t("trainingExamples")}
        value={String(totalExamples)}
        icon={BookOpen}
        footer={
          <span className="text-gray-500 dark:text-gray-400">
            <span className="font-bold text-slate-900 dark:text-slate-100">{goodExamples}</span>
            {` ${t("goodExamplesLabel")}, `}
            <span className="font-bold text-slate-900 dark:text-slate-100">{badExamples}</span>
            {` ${t("badExamplesLabel")}`}
          </span>
        }
      />

      <StatCard
        label={t("lastTraining")}
        value={lastTraining}
        valueClassName="text-2xl"
        icon={CheckCircle}
        footer={
          <span className="text-gray-500 dark:text-gray-400">
            {t("next")}: <span className="font-bold text-slate-900 dark:text-slate-100">{t("tomorrow")}</span>
          </span>
        }
      />

      <StatCard
        label={t("feedbackReceived")}
        value={String(feedbackCount)}
        icon={ThumbsUp}
        footer={<span className="text-gray-500 dark:text-gray-400">{t("thisMonth")}</span>}
      />
    </div>
  );
}