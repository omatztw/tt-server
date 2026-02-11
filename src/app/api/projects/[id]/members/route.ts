import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const AddProjectMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["member", "lead"]).default("member"),
});

// プロジェクトメンバー一覧取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
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
        },
      },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Get project members error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project members" },
      { status: 500 }
    );
  }
}

// プロジェクトにメンバー追加
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = AddProjectMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId, role } = parsed.data;

    const [project, user] = await Promise.all([
      prisma.project.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const member = await prisma.projectMember.upsert({
      where: { userId_projectId: { userId, projectId: id } },
      update: { role },
      create: { userId, projectId: id, role },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Add project member error:", error);
    return NextResponse.json(
      { error: "Failed to add project member" },
      { status: 500 }
    );
  }
}

// プロジェクトからメンバー削除
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

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId, projectId: id } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove project member error:", error);
    return NextResponse.json(
      { error: "Failed to remove project member" },
      { status: 500 }
    );
  }
}
