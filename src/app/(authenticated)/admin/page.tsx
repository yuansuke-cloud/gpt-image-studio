// src/app/(authenticated)/admin/page.tsx
// 管理后台首页 - 全局统计
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminStats } from "@/types";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">管理后台</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="总用户数" value={stats?.totalUsers ?? 0} />
        <StatCard label="总生成次数" value={stats?.totalGenerations ?? 0} />
        <StatCard label="总图片数" value={stats?.totalImages ?? 0} />
        <StatCard label="总消耗额度" value={stats?.totalCreditsUsed ?? 0} />
        <StatCard label="今日生成" value={stats?.todayGenerations ?? 0} />
        <StatCard
          label="今日成本"
          value={`$${(stats?.todayCost ?? 0).toFixed(2)}`}
        />
      </div>

      {/* 快捷入口 */}
      <div className="flex gap-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          用户管理
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="p-4 bg-white rounded-lg border shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
    </div>
  );
}
