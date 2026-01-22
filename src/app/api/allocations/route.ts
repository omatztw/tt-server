import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const AllocationSchema = z.object({
  timeRecordId: z.string(),
  projectId: z.string(),
  seconds: z.number().int().positive(),
  saveAsRule: z.boolean().default(false), // 今後同じアプリに自動適用するか
});

// 分類結果を取得（日付とユーザーでフィルタ）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (date) {
      where.timeRecord = {
        date: new Date(date),
      };
    }

    const allocations = await prisma.timeAllocation.findMany({
      where,
      include: {
        timeRecord: true,
        project: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ allocations });
  } catch (error) {
    console.error("Get allocations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch allocations" },
      { status: 500 }
    );
  }
}

// 分類を作成/更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AllocationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { timeRecordId, projectId, seconds, saveAsRule } = parsed.data;

    // TimeRecordを取得してユーザー情報を取得
    const timeRecord = await prisma.timeRecord.findUnique({
      where: { id: timeRecordId },
    });

    if (!timeRecord) {
      return NextResponse.json(
        { error: "Time record not found" },
        { status: 404 }
      );
    }

    // 既存の割り当てを削除して新しい割り当てを作成
    await prisma.timeAllocation.deleteMany({
      where: { timeRecordId },
    });

    const allocation = await prisma.timeAllocation.create({
      data: {
        userId: timeRecord.userId,
        timeRecordId,
        projectId,
        seconds,
        isAutomatic: false,
      },
      include: {
        project: true,
        timeRecord: true,
      },
    });

    // 自動分類ルールとして保存
    if (saveAsRule) {
      const domainKey = timeRecord.domain ?? "";
      await prisma.allocationRule.upsert({
        where: {
          userId_processName_domain: {
            userId: timeRecord.userId,
            processName: timeRecord.processName,
            domain: domainKey,
          },
        },
        update: {
          projectId,
        },
        create: {
          userId: timeRecord.userId,
          processName: timeRecord.processName,
          domain: timeRecord.domain ?? "",
          projectId,
        },
      });
    }

    return NextResponse.json({ allocation }, { status: 201 });
  } catch (error) {
    console.error("Create allocation error:", error);
    return NextResponse.json(
      { error: "Failed to create allocation" },
      { status: 500 }
    );
  }
}
