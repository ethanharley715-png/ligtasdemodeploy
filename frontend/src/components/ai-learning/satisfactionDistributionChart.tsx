import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useLanguage } from "../../context/useLanguage";

const COLORS = [
  "#000000",
  "#374151",
  "#9CA3AF",
];

export function SatisfactionDistributionChart() {
  const { t } = useLanguage();

  const data = [
    { name: t("happy"), value: 72 },
    { name: t("neutral"), value: 18 },
    { name: t("unhappy"), value: 10 },
  ];

  return (
    <div className="rounded-2xl bg-white p-6 shadow dark:bg-gray-900">
      <h2 className="mb-4 text-xl font-semibold text-black dark:text-white">
        {t("userSatisfactionDistribution")}
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Tooltip formatter={(value) => `${value}%`} />
          <Legend />

          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey="value"
            label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
        <i>{t("satisfactionDistributionDescription")}</i>
      </p>
    </div>
  );
}