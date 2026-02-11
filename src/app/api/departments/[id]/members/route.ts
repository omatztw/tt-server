import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const AddMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["member", "manager"]).default("member"),
  isPrimary: z.boolean().default(false),
});

// 部署メンバー一覧取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
    });
    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    const members = await prisma.departmentMember.findMany({
      where: { departmentId: id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Get department members error:", error);
    return NextResponse.json(
      { error: "Failed to fetch department members" },
      { status: 500 }
    );
  }
}

// 部署にメンバー追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = AddMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId, role, isPrimary } = parsed.data;

    // 部署・ユーザーの存在確認
    const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // isPrimaryを設定する場合、既存の主務を解除
    if (isPrimary) {
      await prisma.departmentMember.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const member = await prisma.departmentMember.upsert({
      where: { userId_departmentId: { userId, departmentId: id } },
      update: { role, isPrimary },
      create: { userId, departmentId: id, role, isPrimary },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Add department member error:", error);
    return NextResponse.json(
      { error: "Failed to add department member" },
      { status: 500 }
    );
  }
}

// 部署からメンバー削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    await prisma.departmentMember.delete({
      where: { userId_departmentId: { userId, departmentId: id } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove department member error:", error);
    return NextResponse.json(
      { error: "Failed to remove department member" },
      { status: 500 }
    );
  }
}
