"use client";

import { useState, useEffect, useCallback } from "react";

type Department = {
  id: string;
  name: string;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string }[];
  members: {
    id: string;
    role: string;
    isPrimary: boolean;
    user: { id: string; name: string | null; email: string };
  }[];
  _count: { members: number };
};

type User = {
  id: string;
  name: string | null;
  email: string;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // 作成フォーム
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");

  // メンバー追加
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"member" | "manager">("member");
  const [addIsPrimary, setAddIsPrimary] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);
      const deptData = await deptRes.json();
      const userData = await userRes.json();
      setDepartments(deptData.departments || []);
      setUsers(userData.users || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        parentId: newParentId || undefined,
      }),
    });

    if (res.ok) {
      setNewName("");
      setNewParentId("");
      fetchData();
    }
  };

  const handleAddMember = async (departmentId: string) => {
    if (!addUserId) return;

    const res = await fetch(`/api/departments/${departmentId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: addUserId,
        role: addRole,
        isPrimary: addIsPrimary,
      }),
    });

    if (res.ok) {
      setAddingTo(null);
      setAddUserId("");
      setAddRole("member");
      setAddIsPrimary(false);
      fetchData();
    }
  };

  const handleRemoveMember = async (
    departmentId: string,
    userId: string
  ) => {
    const res = await fetch(
      `/api/departments/${departmentId}/members?userId=${userId}`,
      { method: "DELETE" }
    );
    if (res.ok) fetchData();
  };

  // 階層表示のためにツリー構造を構築
  const rootDepts = departments.filter((d) => !d.parentId);
  const childMap = new Map<string, Department[]>();
  for (const d of departments) {
    if (d.parentId) {
      const children = childMap.get(d.parentId) || [];
      children.push(d);
      childMap.set(d.parentId, children);
    }
  }

  if (loading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">部署管理</h1>

      {/* 部署作成フォーム */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">部署作成</h2>
        <form onSubmit={handleCreateDepartment} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm text-gray-600">部署名</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="部署名を入力"
              required
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-gray-600">
              親部署（任意）
            </label>
            <select
              value={newParentId}
              onChange={(e) => setNewParentId(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="">なし（トップレベル）</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            作成
          </button>
        </form>
      </div>

      {/* 部署一覧（ツリー表示） */}
      <div className="space-y-4">
        {rootDepts.map((dept) => (
          <DepartmentCard
            key={dept.id}
            dept={dept}
            childMap={childMap}
            depth={0}
            addingTo={addingTo}
            setAddingTo={setAddingTo}
            addUserId={addUserId}
            setAddUserId={setAddUserId}
            addRole={addRole}
            setAddRole={setAddRole}
            addIsPrimary={addIsPrimary}
            setAddIsPrimary={setAddIsPrimary}
            handleAddMember={handleAddMember}
            handleRemoveMember={handleRemoveMember}
            users={users}
          />
        ))}
      </div>
    </div>
  );
}

function DepartmentCard({
  dept,
  childMap,
  depth,
  addingTo,
  setAddingTo,
  addUserId,
  setAddUserId,
  addRole,
  setAddRole,
  addIsPrimary,
  setAddIsPrimary,
  handleAddMember,
  handleRemoveMember,
  users,
}: {
  dept: Department;
  childMap: Map<string, Department[]>;
  depth: number;
  addingTo: string | null;
  setAddingTo: (id: string | null) => void;
  addUserId: string;
  setAddUserId: (id: string) => void;
  addRole: "member" | "manager";
  setAddRole: (role: "member" | "manager") => void;
  addIsPrimary: boolean;
  setAddIsPrimary: (v: boolean) => void;
  handleAddMember: (departmentId: string) => void;
  handleRemoveMember: (departmentId: string, userId: string) => void;
  users: User[];
}) {
  const children = childMap.get(dept.id) || [];
  const existingUserIds = new Set(dept.members.map((m) => m.user.id));

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-medium">{dept.name}</h3>
            {dept.parent && (
              <span className="text-sm text-gray-500">
                親: {dept.parent.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {dept._count.members}名
            </span>
            <button
              onClick={() =>
                setAddingTo(addingTo === dept.id ? null : dept.id)
              }
              className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
            >
              {addingTo === dept.id ? "閉じる" : "メンバー追加"}
            </button>
          </div>
        </div>

        {/* メンバー追加フォーム */}
        {addingTo === dept.id && (
          <div className="border-b bg-gray-50 px-6 py-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">
                  ユーザー
                </label>
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                >
                  <option value="">選択...</option>
                  {users
                    .filter((u) => !existingUserIds.has(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  役割
                </label>
                <select
                  value={addRole}
                  onChange={(e) =>
                    setAddRole(e.target.value as "member" | "manager")
                  }
                  className="rounded border px-2 py-1.5 text-sm"
                >
                  <option value="member">メンバー</option>
                  <option value="manager">マネージャー</option>
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={addIsPrimary}
                  onChange={(e) => setAddIsPrimary(e.target.checked)}
                />
                主務
              </label>
              <button
                onClick={() => handleAddMember(dept.id)}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                追加
              </button>
            </div>
          </div>
        )}

        {/* メンバー一覧 */}
        {dept.members.length > 0 && (
          <div className="px-6 py-3">
            <div className="space-y-2">
              {dept.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{m.user.name || m.user.email}</span>
                    {m.role === "manager" && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                        マネージャー
                      </span>
                    )}
                    {m.isPrimary && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        主務
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveMember(dept.id, m.user.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 子部署 */}
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((child) => (
            <DepartmentCard
              key={child.id}
              dept={child}
              childMap={childMap}
              depth={depth + 1}
              addingTo={addingTo}
              setAddingTo={setAddingTo}
              addUserId={addUserId}
              setAddUserId={setAddUserId}
              addRole={addRole}
              setAddRole={setAddRole}
              addIsPrimary={addIsPrimary}
              setAddIsPrimary={setAddIsPrimary}
              handleAddMember={handleAddMember}
              handleRemoveMember={handleRemoveMember}
              users={users}
            />
          ))}
        </div>
      )}
    </div>
  );
}
