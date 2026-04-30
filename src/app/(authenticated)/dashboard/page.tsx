// src/app/(authenticated)/dashboard/page.tsx
// 仪表盘页面
"use client";

import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";
import type { DashboardStats } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data: stats, isLoading } = useSWR<DashboardStats>("/api/dashboard");

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-6 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 shadow-sm">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-9 w-24" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard label="总生成次数" value={stats?.totalGenerations ?? 0} />
            <StatCard label="总图片数" value={stats?.totalImages ?? 0} />
            <StatCard label="已用额度" value={stats?.creditsUsed ?? 0} />
            <StatCard label="剩余额度" value={stats?.creditsRemaining ?? 0} highlight />
          </>
        )}
      </div>

      {/* 快捷操作 */}
      <div className="flex gap-4">
        <Link
          href="/generate"
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          开始生图
        </Link>
        <Link
          href="/history"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-700 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          查看历史
        </Link>
      </div>

      {/* 最近生成 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">最近生成</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : stats?.recentGenerations && stats.recentGenerations.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.recentGenerations.map((gen: any) =>
              gen.images?.map((img: any) => (
                <div
                  key={img.id}
                  className="aspect-square rounded-lg overflow-hidden border dark:border-gray-800 bg-white dark:bg-gray-900 relative"
                >
                  {img.url.startsWith("/") ? (
                    // 本地图片用 img 标签（Next.js Image 不支持相对路径）
                    <img
                      src={img.url}
                      alt={gen.prompt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Image
                      src={img.url}
                      alt={gen.prompt}
                      fill
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-cover"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">还没有生成记录，去生成第一张图吧</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`text-3xl font-bold mt-1 ${
          highlight ? "text-blue-600" : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}