import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { AllocationForm } from "./AllocationForm";

export const dynamic = "force-dynamic";

async function getUnallocatedRecords() {
  return prisma.timeRecord.findMany({
    where: {
      allocations: { none: {} },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ date: "desc" }, { totalSeconds: "desc" }],
    take: 50,
  });
}

async function getProjects() {
  return prisma.project.findMany({
    where: { isActive: true },
    orderBy: [{ isCapex: "desc" }, { name: "asc" }],
  });
}

export default async function AllocationsPage() {
  const [records, projects] = await Promise.all([
    getUnallocatedRecords(),
    getProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">分類</h1>

      {records.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          未分類のデータはありません
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="rounded-lg border bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {format(record.date, "yyyy/MM/dd")}
                    </span>
                    <span className="text-sm text-gray-500">
                      {record.user.name || record.user.email}
                    </span>
                  </div>
                  <p className="mt-1 font-medium">
                    {record.processName}
                    {record.domain && (
                      <span className="ml-2 text-gray-400">
                        ({record.domain})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {Math.round(record.totalSeconds / 60)}分（
                    {Math.round((record.totalSeconds / 3600) * 100) / 100}時間）
                  </p>
                </div>
                <AllocationForm
                  recordId={record.id}
                  totalSeconds={record.totalSeconds}
                  projects={projects}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
