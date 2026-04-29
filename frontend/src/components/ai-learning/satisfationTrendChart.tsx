import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useLanguage } from "../../context/useLanguage";

export function SatisfactionTrendChart() {
  const { t } = useLanguage();

  const satisfactionData = [
    { date: t("jan"), satisfaction: 43 },
    { date: t("feb"), satisfaction: 78 },
    { date: t("mar"), satisfaction: 65 },
    { date: t("apr"), satisfaction: 36 },
    { date: t("may"), satisfaction: 91 },
  ];

  return (
    <div className="rounded-2xl bg-white p-6 shadow dark:bg-gray-900">
      <h2 className="mb-4 text-xl font-semibold text-black dark:text-white">
        {t("userSatisfactionOverTime")}
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={satisfactionData}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="date" />

          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />

          <Tooltip
            formatter={(value: number | undefined) =>
              value !== undefined ? `${value}%` : ""
            }
            labelFormatter={(label) => `${t("month")}: ${label}`}
          />

          <Line
            type="monotone"
            dataKey="satisfaction"
            stroke="#9CA3AF"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
        <i>{t("satisfactionTrendDescription")}</i>
      </p>
    </div>
  );
}