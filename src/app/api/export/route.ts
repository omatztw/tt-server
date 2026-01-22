import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
} from "date-fns";

// Excelエクスポート
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get("month"); // YYYY-MM形式
    const userId = searchParams.get("userId");

    if (!yearMonth) {
      return NextResponse.json(
        { error: "month parameter is required (YYYY-MM)" },
        { status: 400 }
      );
    }

    const monthStart = startOfMonth(parseISO(`${yearMonth}-01`));
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // フィルタ条件
    const where: Record<string, unknown> = {
      timeRecord: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    };

    if (userId) {
      where.userId = userId;
    }

    // 仕分けされたデータを取得
    const allocations = await prisma.timeAllocation.findMany({
      where,
      include: {
        project: true,
        timeRecord: true,
        user: { select: { name: true, email: true } },
      },
    });

    // プロジェクト一覧を取得（資産計上対象で分類）
    const allProjects = await prisma.project.findMany({
      where: { isActive: true },
      orderBy: [{ isCapex: "desc" }, { name: "asc" }],
    });

    // Excelワークブック作成
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "TimeTracker";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("工数集計");

    // ヘッダー行を作成
    const headerRow = ["日付", ...allProjects.map((p) => p.name)];
    sheet.addRow(headerRow);

    // ヘッダーのスタイル設定
    const headerRowObj = sheet.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // 資産計上対象プロジェクトの列を強調
    allProjects.forEach((project, idx) => {
      if (project.isCapex) {
        const cell = sheet.getCell(1, idx + 2);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFEB3B" }, // 黄色
        };
      }
    });

    // 日付ごとにデータを集計
    for (const day of daysInMonth) {
      const dateStr = format(day, "M/d");
      const rowData: (string | number)[] = [dateStr];

      for (const project of allProjects) {
        const projectAllocations = allocations.filter(
          (a) =>
            a.projectId === project.id &&
            format(a.timeRecord.date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
        );

        // 秒を時間に変換して合計
        const totalSeconds = projectAllocations.reduce(
          (sum, a) => sum + a.seconds,
          0
        );
        const hours = Math.round((totalSeconds / 3600) * 100) / 100; // 小数点2桁

        rowData.push(hours > 0 ? hours : "");
      }

      sheet.addRow(rowData);
    }

    // 合計行を追加
    const totalRow: (string | number)[] = ["合計"];
    for (const project of allProjects) {
      const projectAllocations = allocations.filter(
        (a) => a.projectId === project.id
      );
      const totalSeconds = projectAllocations.reduce(
        (sum, a) => sum + a.seconds,
        0
      );
      const hours = Math.round((totalSeconds / 3600) * 100) / 100;
      totalRow.push(hours > 0 ? hours : 0);
    }
    const totalRowObj = sheet.addRow(totalRow);
    totalRowObj.font = { bold: true };
    totalRowObj.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // 列幅を調整
    sheet.columns.forEach((column) => {
      column.width = 15;
    });

    // Excelファイルをバッファとして出力
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = userId
      ? `工数集計_${yearMonth}_${userId}.xlsx`
      : `工数集計_${yearMonth}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
