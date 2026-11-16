"use client";

import { useRouter } from "next/navigation";

export function ProjectSelect({
  projects,
  current,
  tab,
}: {
  projects: { id: string; name: string }[];
  current: string;
  tab: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="eyebrow">Projeto</span>
      <select
        value={current}
        onChange={(e) => router.push(`/dashboard?tab=${tab}&p=${e.target.value}`)}
        className="field w-auto py-1 font-bold"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
