import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TimeTracker - 工数管理システム",
  description: "従業員の作業時間を記録し、プロジェクト別に分類して資産化工数を算出",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
