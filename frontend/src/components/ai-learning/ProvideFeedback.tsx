import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { ReviewReportCard } from "./ReviewReportCard";
import { FeedbackStatCard } from "./FeedbackStatCard";
import {
  aiLearningApi,
  type PendingReview,
  type FeedbackStats,
} from "../../services/api";
import { useLanguage } from "../../context/useLanguage";

interface ProvideFeedbackProps {
  refreshKey?: number;
  onDataChanged?: () => void;
}

export function ProvideFeedback({ refreshKey = 0, onDataChanged }: ProvideFeedbackProps) {
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [fbStats, setFbStats] = useState<FeedbackStats>({
    positive: 0,
    negative: 0,
    satisfactionRate: 0,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      aiLearningApi.pendingReview().then((data) => {
        if (!cancelled) setPending(data);
      }),
      aiLearningApi.feedbackStats().then((data) => {
        if (!cancelled) setFbStats(data);
      }),
    ]).catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleFeedback = async (rating: "correct" | "needs_improvement") => {
    if (!pending) return;

    try {
      await aiLearningApi.submitFeedback(pending.reportId, rating);

      const [nextPending, updatedStats] = await Promise.all([
        aiLearningApi.pendingReview(),
        aiLearningApi.feedbackStats(),
      ]);

      setPending(nextPending);
      setFbStats(updatedStats);
      onDataChanged?.();
    } catch (err) {
      toast.error(t("feedbackFailed"), {
        description: err instanceof Error ? err.message : t("somethingWentWrongTryAgain"),
      });
    }
  };

  return (
    <Card className="border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-3 text-lg font-bold text-black dark:text-white">
        {t("helpImproveAiAccuracy")}
      </h3>

      <p className="mb-6 text-gray-500 dark:text-gray-400">
        {t("helpImproveAiAccuracyDescription")}
      </p>

      {pending ? (
        <ReviewReportCard
          reportId={pending.reportId}
          fileName={pending.fileName}
          issuesDetected={pending.issuesDetected}
          onCorrect={() => handleFeedback("correct")}
          onNeedsImprovement={() => handleFeedback("needs_improvement")}
        />
      ) : (
        <Card className="border-2 border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/80">
          <p className="text-gray-500 dark:text-gray-400">{t("noReportsPendingReview")}</p>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <FeedbackStatCard value={String(fbStats.positive)} label={t("positiveFeedback")} />
        <FeedbackStatCard value={String(fbStats.negative)} label={t("negativeFeedback")} />
        <FeedbackStatCard value={`${fbStats.satisfactionRate}%`} label={t("satisfactionRate")} />
      </div>
    </Card>
  );
}
