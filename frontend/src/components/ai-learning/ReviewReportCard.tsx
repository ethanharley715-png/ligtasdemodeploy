import { CheckCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card } from "../ui/card";

interface ReviewReportCardProps {
  reportId: string;
  fileName: string;
  issuesDetected: number;
  onCorrect?: () => void;
  onNeedsImprovement?: () => void;
}

export function ReviewReportCard({
  reportId,
  fileName,
  issuesDetected,
  onCorrect,
  onNeedsImprovement,
}: ReviewReportCardProps) {
  return (
    <Card className="border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start gap-3 mb-4">
        <CheckCircle className="size-6 text-gray-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-black">Review Report: {reportId}</p>
          <p className="text-sm text-gray-500">{fileName}</p>
          <p className="text-sm text-gray-500">
            AI detected {issuesDetected} issues
          </p>
        </div>
      </div>

      <p className="font-bold text-black mb-3">
        Were the detected issues accurate?
      </p>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onCorrect}
          className="flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors"
        >
          <ThumbsUp className="size-5" />
          Yes, Issues Correct
        </button>
        <button
          type="button"
          onClick={onNeedsImprovement}
          className="flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-600 border-2 border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ThumbsDown className="size-5" />
          No, Needs Improvement
        </button>
      </div>
    </Card>
  );
}
