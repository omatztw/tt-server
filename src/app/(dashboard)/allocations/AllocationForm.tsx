"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  code: string;
  isCapex: boolean;
};

type AllocationFormProps = {
  recordId: string;
  totalSeconds: number;
  projects: Project[];
};

export function AllocationForm({
  recordId,
  totalSeconds,
  projects,
}: AllocationFormProps) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState("");
  const [saveAsRule, setSaveAsRule] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedProject) return;

    setLoading(true);
    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeRecordId: recordId,
          projectId: selectedProject,
          seconds: totalSeconds,
          saveAsRule,
        }),
      });

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedProject}
        onChange={(e) => setSelectedProject(e.target.value)}
        className="rounded border px-3 py-2 text-sm"
      >
        <option value="">プロジェクトを選択</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.isCapex && "★ "}
            {project.name} ({project.code})
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={saveAsRule}
          onChange={(e) => setSaveAsRule(e.target.checked)}
          className="rounded"
        />
        <span>自動適用</span>
      </label>
      <button
        onClick={handleSubmit}
        disabled={!selectedProject || loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "..." : "割当"}
      </button>
    </div>
  );
}
