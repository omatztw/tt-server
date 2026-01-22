import { prisma } from "@/lib/prisma";
import { ProjectForm } from "./ProjectForm";

export const dynamic = "force-dynamic";

async function getProjects() {
  return prisma.project.findMany({
    orderBy: [{ isCapex: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { timeAllocations: true },
      },
    },
  });
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">プロジェクト管理</h1>
      </div>

      {/* 新規プロジェクト作成フォーム */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">新規プロジェクト</h2>
        <ProjectForm />
      </div>

      {/* プロジェクト一覧 */}
      <div className="rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-medium">プロジェクト一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-sm text-gray-500">
              <tr>
                <th className="px-6 py-3">コード</th>
                <th className="px-6 py-3">名前</th>
                <th className="px-6 py-3">説明</th>
                <th className="px-6 py-3">資産計上</th>
                <th className="px-6 py-3">記録数</th>
                <th className="px-6 py-3">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {projects.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    プロジェクトがありません
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id}>
                    <td className="px-6 py-4 font-mono">{project.code}</td>
                    <td className="px-6 py-4 font-medium">{project.name}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {project.description || "-"}
                    </td>
                    <td className="px-6 py-4">
                      {project.isCapex ? (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                          資産
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{project._count.timeAllocations}</td>
                    <td className="px-6 py-4">
                      {project.isActive ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                          有効
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          無効
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
