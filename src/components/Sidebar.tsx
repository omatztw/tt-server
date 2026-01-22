"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "ダッシュボード", href: "/" },
  { name: "分類", href: "/allocations" },
  { name: "プロジェクト", href: "/projects" },
  { name: "エクスポート", href: "/export" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col px-3 py-4">
        <Link href="/" className="mb-8 flex items-center pl-2.5">
          <span className="self-center whitespace-nowrap text-xl font-semibold">
            TimeTracker
          </span>
        </Link>
        <nav className="flex-1 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center rounded-lg p-2 text-base font-normal ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
