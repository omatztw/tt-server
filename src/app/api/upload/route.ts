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

    // loginId（WindowsログインUPN）を正規化
    const loginId = user_id.includes("\\")
      ? user_id.split("\\")[1] // DOMAIN\user → user
      : user_id;

    // まずloginIdでユーザーを検索
    let user = await prisma.user.findUnique({
      where: { loginId },
    });

    // loginIdで見つからない場合、emailでも検索（後方互換性）
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: loginId },
      });
      // 見つかった場合、loginIdを設定
      if (user && !user.loginId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { loginId },
        });
      }
    }

    // どちらでも見つからない場合は新規作成
    if (!user) {
      // 仮のメールアドレスを生成（SAML認証時に正しいメールに更新される）
      const placeholderEmail = loginId.includes("@")
        ? loginId
        : `${loginId}@placeholder.local`;

      user = await prisma.user.create({
        data: {
          email: placeholderEmail,
          loginId,
          name: user_id,
        },
      });
    }

    const recordDate = new Date(date);
    const createdRecords: string[] = [];

    // 自動分類ルールを取得
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

      // 自動分類ルールが存在する場合は自動割り当て
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
