"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

type ProjectSummary = {
  projectId: string;
  projectName: string;
  projectCode: string;
  isCapex: boolean;
  seconds: number;
  hours: number;
};

type DailyTotal = {
  date: string;
  totalHours: number;
  allocatedHours: number;
  unallocatedHours: number;
};

export function TeamCharts({
  projectSummary,
  dailyTotals,
}: {
  projectSummary: ProjectSummary[];
  dailyTotals: DailyTotal[];
}) {
  const pieData = projectSummary.map((p) => ({
    name: p.projectCode,
    value: p.hours,
    fullName: p.projectName,
    isCapex: p.isCapex,
  }));

  const dailyData = dailyTotals.map((d) => ({
    date: d.date.slice(5), // MM-DD
    配賦済: d.allocatedHours,
    未分類: d.unallocatedHours,
  }));

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* プロジェクト別配分（円グラフ） */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 font-medium text-gray-700">
          プロジェクト別工数配分
        </h3>
        {pieData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            データがありません
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number, _name: string, props: any) => [
                  `${value}h`,
                  props?.payload?.fullName ?? _name,
                ]) as never}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 日別稼働推移（エリアチャート） */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 font-medium text-gray-700">日別稼働推移</h3>
        {dailyData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            データがありません
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="h" />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="配賦済"
                stackId="1"
                stroke="#3b82f6"
                fill="#93c5fd"
              />
              <Area
                type="monotone"
                dataKey="未分類"
                stackId="1"
                stroke="#f59e0b"
                fill="#fcd34d"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
