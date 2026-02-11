"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subMonths } from "date-fns";
import { TeamCharts } from "./TeamCharts";

type MemberStat = {
  id: string;
  name: string;
  department: string | null;
  projects: {
    projectId: string;
    projectName: string;
    projectCode: string;
    seconds: number;
    hours: number;
  }[];
  unallocatedHours: number;
  totalAllocatedHours: number;
  activities: {
    name: string;
    seconds: number;
    hours: number;
  }[];
};

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

type WorkloadData = {
  month: string;
  members: MemberStat[];
  projectSummary: ProjectSummary[];
  dailyTotals: DailyTotal[];
};

type Department = {
  id: string;
  name: string;
};

export default function TeamPage() {
  const [data, setData] = useState<WorkloadData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.json())
      .then((d) => setDepartments(d.departments || []))
      .catch(() => {});
  }, []);

  const fetchWorkload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (departmentId) params.set("departmentId", departmentId);

      const res = await fetch(`/api/team/workload?${params}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to fetch");
        return;
      }
      const result = await res.json();
      setData(result);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [month, departmentId]);

  useEffect(() => {
    fetchWorkload();
  }, [fetchWorkload]);

  const selectedMemberData = data?.members.find(
    (m) => m.id === selectedMember
  );

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">チーム工数</h1>

      {/* フィルター */}
      <div className="mb-6 flex gap-4 items-end">
        <div>
          <label className="mb-1 block text-sm text-gray-600">対象月</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">部署</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">全部署</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {loading && <div className="text-gray-500">読み込み中...</div>}

      {data && !loading && (
        <>
          {/* プロジェクト別合計 + 日別推移グラフ */}
          <TeamCharts
            projectSummary={data.projectSummary}
            dailyTotals={data.dailyTotals}
          />

          {/* メンバー一覧テーブル */}
          <div className="mb-8 rounded-lg border bg-white">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-medium">メンバー別工数</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-sm text-gray-500">
                  <tr>
                    <th className="px-6 py-3">メンバー</th>
                    <th className="px-6 py-3">部署</th>
                    <th className="px-6 py-3 text-right">配賦済(h)</th>
                    <th className="px-6 py-3 text-right">未分類(h)</th>
                    <th className="px-6 py-3">プロジェクト内訳</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {data.members.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    data.members.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">
                          {member.name}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {member.department || "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {member.totalAllocatedHours}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {member.unallocatedHours > 0 ? (
                            <span className="text-yellow-600">
                              {member.unallocatedHours}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {member.projects.slice(0, 3).map((p) => (
                              <span
                                key={p.projectId}
                                className="rounded bg-gray-100 px-2 py-0.5 text-xs"
                              >
                                {p.projectCode}: {p.hours}h
                              </span>
                            ))}
                            {member.projects.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{member.projects.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              setSelectedMember(
                                selectedMember === member.id
                                  ? null
                                  : member.id
                              )
                            }
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {selectedMember === member.id
                              ? "閉じる"
                              : "詳細"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 選択メンバーの詳細 */}
          {selectedMemberData && (
            <MemberDetail member={selectedMemberData} />
          )}
        </>
      )}
    </div>
  );
}

function MemberDetail({ member }: { member: MemberStat }) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-medium">
          {member.name} の詳細
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        {/* プロジェクト別工数 */}
        <div>
          <h3 className="mb-3 font-medium text-gray-700">プロジェクト別工数</h3>
          {member.projects.length === 0 ? (
            <p className="text-sm text-gray-500">配賦データなし</p>
          ) : (
            <div className="space-y-2">
              {member.projects.map((p) => {
                const totalHours =
                  member.totalAllocatedHours + member.unallocatedHours;
                const pct =
                  totalHours > 0
                    ? Math.round((p.hours / totalHours) * 100)
                    : 0;
                return (
                  <div key={p.projectId}>
                    <div className="flex justify-between text-sm">
                      <span>
                        {p.projectName} ({p.projectCode})
                      </span>
                      <span className="font-medium">{p.hours}h ({pct}%)</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {member.unallocatedHours > 0 && (
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-600">未分類</span>
                    <span className="font-medium text-yellow-600">
                      {member.unallocatedHours}h
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-yellow-400"
                      style={{
                        width: `${
                          Math.round(
                            (member.unallocatedHours /
                              (member.totalAllocatedHours +
                                member.unallocatedHours)) *
                              100
                          ) || 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* アプリ/作業別使用時間 */}
        <div>
          <h3 className="mb-3 font-medium text-gray-700">
            アプリケーション別使用時間
          </h3>
          {member.activities.length === 0 ? (
            <p className="text-sm text-gray-500">データなし</p>
          ) : (
            <div className="space-y-2">
              {member.activities.map((act, i) => {
                const maxHours = member.activities[0]?.hours || 1;
                const pct = Math.round((act.hours / maxHours) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-[200px]" title={act.name}>
                        {act.name}
                      </span>
                      <span className="ml-2 shrink-0 font-medium">
                        {act.hours}h
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
