import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ユーザー一覧取得
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        departmentMembers: {
          include: { department: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
