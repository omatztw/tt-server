import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  isAdmin,
  getManagedMemberIds,
} from "@/lib/authorization";

// チーム工数集計API（マネージャー向け）
// GET /api/team/workload?month=2026-02&departmentId=xxx
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // マネージャーまたはadminのみ
    if (!isAdmin(sessionUser) && sessionUser.managedDepartmentIds.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM
    const departmentId = searchParams.get("departmentId");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "month parameter is required (YYYY-MM format)" },
        { status: 400 }
      );
    }

    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 1);

    // 管理対象メンバーIDを取得
    let memberIds: string[];
    if (departmentId) {
      // 特定部署のメンバー
      const deptMembers = await prisma.departmentMember.findMany({
        where: { departmentId },
        select: { userId: true },
      });
      memberIds = deptMembers.map((m) => m.userId);

      // 権限チェック: この部署を管理できるか
      if (!isAdmin(sessionUser)) {
        const managedIds = await getManagedMemberIds(sessionUser);
        memberIds = memberIds.filter((id) => managedIds.includes(id));
      }
    } else {
      memberIds = await getManagedMemberIds(sessionUser);
    }

    if (memberIds.length === 0) {
      return NextResponse.json({
        members: [],
        projectSummary: [],
        dailyTotals: [],
      });
    }

    // メンバー情報
    const members = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: {
        id: true,
        name: true,
        email: true,
        departmentMembers: {
          include: { department: { select: { name: true } } },
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    // メンバーごとのプロジェクト別工数集計
    const allocations = await prisma.timeAllocation.findMany({
      where: {
        userId: { in: memberIds },
        timeRecord: {
          date: { gte: startDate, lt: endDate },
        },
      },
      include: {
        project: { select: { id: true, name: true, code: true, isCapex: true } },
        timeRecord: { select: { date: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // 全TimeRecord（未分類含む）
    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        userId: { in: memberIds },
        date: { gte: startDate, lt: endDate },
      },
      include: {
        user: { select: { id: true } },
        allocations: { select: { id: true } },
      },
    });

    // --- 集計: メンバー × プロジェクト ---
    const memberProjectMap: Record<
      string,
      Record<string, { projectName: string; projectCode: string; seconds: number }>
    > = {};

    for (const alloc of allocations) {
      const uid = alloc.user.id;
      const pid = alloc.project.id;
      if (!memberProjectMap[uid]) memberProjectMap[uid] = {};
      if (!memberProjectMap[uid][pid]) {
        memberProjectMap[uid][pid] = {
          projectName: alloc.project.name,
          projectCode: alloc.project.code,
          seconds: 0,
        };
      }
      memberProjectMap[uid][pid].seconds += alloc.seconds;
    }

    // メンバーごとの未分類秒数
    const memberUnallocatedMap: Record<string, number> = {};
    for (const rec of timeRecords) {
      if (rec.allocations.length === 0) {
        const uid = rec.user.id;
        memberUnallocatedMap[uid] =
          (memberUnallocatedMap[uid] || 0) + rec.totalSeconds;
      }
    }

    // --- 集計: プロジェクト別合計 ---
    const projectTotalMap: Record<
      string,
      { projectName: string; projectCode: string; isCapex: boolean; seconds: number }
    > = {};

    for (const alloc of allocations) {
      const pid = alloc.project.id;
      if (!projectTotalMap[pid]) {
        projectTotalMap[pid] = {
          projectName: alloc.project.name,
          projectCode: alloc.project.code,
          isCapex: alloc.project.isCapex,
          seconds: 0,
        };
      }
      projectTotalMap[pid].seconds += alloc.seconds;
    }

    // --- 集計: 日別合計 ---
    const dailyMap: Record<string, { allocated: number; total: number }> = {};

    for (const rec of timeRecords) {
      const dateKey = rec.date.toISOString().split("T")[0];
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { allocated: 0, total: 0 };
      dailyMap[dateKey].total += rec.totalSeconds;
    }
    for (const alloc of allocations) {
      const dateKey = alloc.timeRecord.date.toISOString().split("T")[0];
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { allocated: 0, total: 0 };
      dailyMap[dateKey].allocated += alloc.seconds;
    }

    // --- 集計: メンバーごとのアプリ/ドメイン別使用時間 ---
    const memberActivityMap: Record<
      string,
      Record<string, number>
    > = {};

    for (const rec of timeRecords) {
      const uid = rec.user.id;
      const label = rec.domain
        ? `${rec.processName} (${rec.domain})`
        : rec.processName;
      if (!memberActivityMap[uid]) memberActivityMap[uid] = {};
      memberActivityMap[uid][label] =
        (memberActivityMap[uid][label] || 0) + rec.totalSeconds;
    }

    // レスポンス構築
    const memberStats = members.map((m) => ({
      id: m.id,
      name: m.name || m.email,
      department:
        m.departmentMembers[0]?.department.name || null,
      projects: Object.entries(memberProjectMap[m.id] || {}).map(
        ([projectId, data]) => ({
          projectId,
          ...data,
          hours: Math.round((data.seconds / 3600) * 10) / 10,
        })
      ),
      unallocatedHours:
        Math.round(((memberUnallocatedMap[m.id] || 0) / 3600) * 10) / 10,
      totalAllocatedHours:
        Math.round(
          (Object.values(memberProjectMap[m.id] || {}).reduce(
            (sum, d) => sum + d.seconds,
            0
          ) /
            3600) *
            10
        ) / 10,
      activities: Object.entries(memberActivityMap[m.id] || {})
        .map(([name, seconds]) => ({
          name,
          seconds,
          hours: Math.round((seconds / 3600) * 10) / 10,
        }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 15), // 上位15件
    }));

    const projectSummary = Object.entries(projectTotalMap)
      .map(([projectId, data]) => ({
        projectId,
        ...data,
        hours: Math.round((data.seconds / 3600) * 10) / 10,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const dailyTotals = Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        totalHours: Math.round((data.total / 3600) * 10) / 10,
        allocatedHours: Math.round((data.allocated / 3600) * 10) / 10,
        unallocatedHours:
          Math.round(((data.total - data.allocated) / 3600) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      month,
      members: memberStats,
      projectSummary,
      dailyTotals,
    });
  } catch (error) {
    console.error("Team workload error:", error);
    return NextResponse.json(
      { error: "Failed to fetch team workload" },
      { status: 500 }
    );
  }
}
