import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 時間記録一覧取得（日付・ユーザーでフィルタ）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const userId = searchParams.get("userId");
    const unallocatedOnly = searchParams.get("unallocatedOnly") === "true";

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (date) {
      where.date = new Date(date);
    }

    let records = await prisma.timeRecord.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        allocations: {
          include: {
            project: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { totalSeconds: "desc" }],
    });

    // 未仕分けのみフィルタ
    if (unallocatedOnly) {
      records = records.filter((r) => r.allocations.length === 0);
    }

    return NextResponse.json({ records });
  } catch (error) {
    console.error("Get time records error:", error);
    return NextResponse.json(
      { error: "Failed to fetch time records" },
      { status: 500 }
    );
  }
}
