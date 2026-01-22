import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const AppSummarySchema = z.object({
  process_name: z.string(),
  total_seconds: z.number().int().positive(),
  domain: z.string().optional(),
});

const UploadRequestSchema = z.object({
  user_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  min_duration_seconds: z.number().int().positive(),
  app_summaries: z.array(AppSummarySchema),
  machine_name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = UploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          error_code: "INVALID_DATA",
        },
        { status: 400 }
      );
    }

    const { user_id, date, min_duration_seconds, app_summaries, machine_name } =
      parsed.data;

    // ユーザーを検索または作成（UPNまたはSAM形式からメールアドレスを抽出）
    const email = user_id.includes("@")
      ? user_id
      : user_id.includes("\\")
        ? `${user_id.split("\\")[1]}@unknown.local`
        : `${user_id}@unknown.local`;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 初回アップロード時にユーザーを自動作成
      user = await prisma.user.create({
        data: {
          email,
          name: user_id,
        },
      });
    }

    const recordDate = new Date(date);
    const createdRecords: string[] = [];

    // 自動仕分けルールを取得
    const rules = await prisma.allocationRule.findMany({
      where: { userId: user.id },
    });

    const rulesMap = new Map(
      rules.map((r) => [`${r.processName}:${r.domain || ""}`, r.projectId])
    );

    for (const summary of app_summaries) {
      const domainValue = summary.domain ?? "";
      // TimeRecordをupsert（同じユーザー・日付・プロセス・ドメインで既存なら更新）
      const record = await prisma.timeRecord.upsert({
        where: {
          userId_date_processName_domain: {
            userId: user.id,
            date: recordDate,
            processName: summary.process_name,
            domain: domainValue,
          },
        },
        update: {
          totalSeconds: summary.total_seconds,
          machineName: machine_name,
        },
        create: {
          userId: user.id,
          date: recordDate,
          processName: summary.process_name,
          domain: domainValue,
          totalSeconds: summary.total_seconds,
          machineName: machine_name,
          minDurationUsed: min_duration_seconds,
        },
      });

      createdRecords.push(record.id);

      // 自動仕分けルールが存在する場合は自動割り当て
      const ruleKey = `${summary.process_name}:${summary.domain || ""}`;
      const projectId = rulesMap.get(ruleKey);

      if (projectId) {
        // 既存の割り当てを確認
        const existingAllocation = await prisma.timeAllocation.findFirst({
          where: {
            timeRecordId: record.id,
            projectId,
          },
        });

        if (!existingAllocation) {
          await prisma.timeAllocation.create({
            data: {
              userId: user.id,
              timeRecordId: record.id,
              projectId,
              seconds: summary.total_seconds,
              isAutomatic: true,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Received ${app_summaries.length} records for ${user_id} on ${date}`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Server error",
        error_code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
