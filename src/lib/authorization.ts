import { auth } from "./auth";
import { prisma } from "./prisma";

export type SessionUser = {
  id: string;
  role: string;
  managedDepartmentIds: string[];
};

// セッションからユーザー情報を取得
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = session.user as {
    id: string;
    role?: string;
    managedDepartmentIds?: string[];
  };

  return {
    id: user.id,
    role: user.role || "member",
    managedDepartmentIds: user.managedDepartmentIds || [],
  };
}

// adminかどうか
export function isAdmin(user: SessionUser): boolean {
  return user.role === "admin";
}

// 指定部署のマネージャーかどうか（子部署も含む）
export async function isManagerOf(
  user: SessionUser,
  departmentId: string
): Promise<boolean> {
  if (isAdmin(user)) return true;

  // 直接管理している部署か
  if (user.managedDepartmentIds.includes(departmentId)) return true;

  // 管理部署の子孫部署か確認
  for (const managedId of user.managedDepartmentIds) {
    const isDescendant = await isDepartmentDescendantOf(
      departmentId,
      managedId
    );
    if (isDescendant) return true;
  }
  return false;
}

// departmentId が ancestorId の子孫かどうか再帰的に確認
async function isDepartmentDescendantOf(
  departmentId: string,
  ancestorId: string
): Promise<boolean> {
  let current = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { parentId: true },
  });

  const visited = new Set<string>();
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    if (visited.has(current.parentId)) return false; // 循環防止
    visited.add(current.parentId);
    current = await prisma.department.findUnique({
      where: { id: current.parentId },
      select: { parentId: true },
    });
  }
  return false;
}

// マネージャーが管理する部署の全メンバーIDを取得（子部署含む）
export async function getManagedMemberIds(
  user: SessionUser
): Promise<string[]> {
  if (isAdmin(user)) {
    // admin は全ユーザーを管理
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    return allUsers.map((u) => u.id);
  }

  const deptIds = await getAllManagedDepartmentIds(user.managedDepartmentIds);

  const members = await prisma.departmentMember.findMany({
    where: { departmentId: { in: deptIds } },
    select: { userId: true },
  });

  return [...new Set(members.map((m) => m.userId))];
}

// 管理部署 + その子孫部署のIDを全て取得
async function getAllManagedDepartmentIds(
  rootIds: string[]
): Promise<string[]> {
  const result = new Set<string>(rootIds);
  const queue = [...rootIds];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await prisma.department.findMany({
      where: { parentId },
      select: { id: true },
    });
    for (const child of children) {
      if (!result.has(child.id)) {
        result.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return [...result];
}
