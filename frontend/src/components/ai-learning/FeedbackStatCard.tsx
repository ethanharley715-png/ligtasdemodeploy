import { Card } from "../ui/card";

interface FeedbackStatCardProps {
  value: string;
  label: string;
}

export function FeedbackStatCard({ value, label }: FeedbackStatCardProps) {
  return (
    <Card className="border-2 border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-3xl font-bold text-black mb-2">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </Card>
  );
}
