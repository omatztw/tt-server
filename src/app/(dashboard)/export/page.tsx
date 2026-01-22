"use client";

import { useState } from "react";
import { format, subMonths } from "date-fns";

export default function ExportPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/export?month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `工数集計_${month}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } finally {
      setLoading(false);
    }
  };

  // 過去12ヶ月の選択肢を生成
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return format(date, "yyyy-MM");
  });

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold">エクスポート</h1>

      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">月次工数集計</h2>
        <p className="mb-4 text-sm text-gray-600">
          選択した月の工数データをExcel形式でエクスポートします。
          日付が行、プロジェクトが列になったフォーマットで出力されます。
        </p>

        <div className="flex items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              対象月
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded border px-3 py-2"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m.replace("-", "年")}月
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={loading}
            className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "エクスポート中..." : "Excelダウンロード"}
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">出力フォーマット</h2>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-4 py-2">日付</th>
                <th className="border bg-yellow-50 px-4 py-2">
                  プロジェクト1（資産）
                </th>
                <th className="border px-4 py-2">プロジェクト2</th>
                <th className="border px-4 py-2">...</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-4 py-2">8/1</td>
                <td className="border bg-yellow-50 px-4 py-2">5.5</td>
                <td className="border px-4 py-2">2.0</td>
                <td className="border px-4 py-2">...</td>
              </tr>
              <tr>
                <td className="border px-4 py-2">8/2</td>
                <td className="border bg-yellow-50 px-4 py-2">4.0</td>
                <td className="border px-4 py-2">3.5</td>
                <td className="border px-4 py-2">...</td>
              </tr>
              <tr className="bg-gray-100 font-bold">
                <td className="border px-4 py-2">合計</td>
                <td className="border bg-yellow-100 px-4 py-2">9.5</td>
                <td className="border px-4 py-2">5.5</td>
                <td className="border px-4 py-2">...</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          ※ 黄色の列は資産計上対象プロジェクトを示します。数値は時間（h）単位です。
        </p>
      </div>
    </div>
  );
}
