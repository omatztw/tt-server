import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateDepartmentSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
});

// 部署一覧取得（階層構造で返す）
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    console.error("Get departments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

// 部署作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateDepartmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, parentId } = parsed.data;

    // 親部署の存在確認
    if (parentId) {
      const parent = await prisma.department.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent department not found" },
          { status: 404 }
        );
      }
    }

    const department = await prisma.department.create({
      data: { name, parentId },
      include: {
        parent: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("Create department error:", error);
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }
}
