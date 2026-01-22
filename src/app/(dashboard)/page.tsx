import { prisma } from "@/lib/prisma";
import { format, subDays } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStats() {
  const today = new Date();
  const weekAgo = subDays(today, 7);

  const [totalUsers, totalProjects, recentRecords, unallocatedCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.project.count({ where: { isActive: true } }),
      prisma.timeRecord.count({
        where: { date: { gte: weekAgo } },
      }),
      prisma.timeRecord.count({
        where: {
          allocations: { none: {} },
        },
      }),
    ]);

  return { totalUsers, totalProjects, recentRecords, unallocatedCount };
}

async function getRecentRecords() {
  return prisma.timeRecord.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      allocations: { include: { project: true } },
    },
  });
}

export default async function DashboardPage() {
  const stats = await getStats();
  const recentRecords = await getRecentRecords();

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">ダッシュボード</h1>

      {/* 統計カード */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="ユーザー数" value={stats.totalUsers} />
        <StatCard title="プロジェクト数" value={stats.totalProjects} />
        <StatCard title="今週の記録数" value={stats.recentRecords} />
        <StatCard
          title="未仕分け"
          value={stats.unallocatedCount}
          highlight={stats.unallocatedCount > 0}
        />
      </div>

      {/* 未仕分けへのリンク */}
      {stats.unallocatedCount > 0 && (
        <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-yellow-800">
            {stats.unallocatedCount}件の未仕分けデータがあります。
            <Link
              href="/allocations"
              className="ml-2 font-medium underline hover:no-underline"
            >
              仕分けする
            </Link>
          </p>
        </div>
      )}

      {/* 最近の記録 */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-medium">最近の記録</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-sm text-gray-500">
              <tr>
                <th className="px-6 py-3">日付</th>
                <th className="px-6 py-3">ユーザー</th>
                <th className="px-6 py-3">アプリ</th>
                <th className="px-6 py-3">時間</th>
                <th className="px-6 py-3">仕分け</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {recentRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    まだデータがありません
                  </td>
                </tr>
              ) : (
                recentRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4">
                      {format(record.date, "yyyy/MM/dd")}
                    </td>
                    <td className="px-6 py-4">
                      {record.user.name || record.user.email}
                    </td>
                    <td className="px-6 py-4">
                      {record.processName}
                      {record.domain && (
                        <span className="ml-1 text-gray-400">
                          ({record.domain})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {Math.round(record.totalSeconds / 60)}分
                    </td>
                    <td className="px-6 py-4">
                      {record.allocations.length > 0 ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                          {record.allocations[0].project.name}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          未仕分け
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 ${
        highlight ? "border-yellow-300 bg-yellow-50" : "bg-white"
      }`}
    >
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
