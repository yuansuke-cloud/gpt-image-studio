// src/app/(authenticated)/credits/page.tsx
// 额度管理页面
"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface CreditLogItem {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  description: string | null;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  INITIAL_GRANT: "注册赠送",
  ADMIN_GRANT: "管理员充值",
  GENERATION: "生图消耗",
  REFUND: "失败退款",
};

export default function CreditsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR(`/api/credits?page=${page}`);

  const balance = data?.balance ?? 0;
  const logs: CreditLogItem[] = data?.logs?.data ?? [];
  const totalPages = data?.logs?.totalPages ?? 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">额度管理</h1>

      {/* 余额卡片 */}
      {isLoading ? (
        <div className="p-8 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 text-center">
          <Skeleton className="h-4 w-16 mx-auto mb-4" />
          <Skeleton className="h-12 w-28 mx-auto mb-2" />
          <Skeleton className="h-4 w-20 mx-auto" />
        </div>
      ) : (
        <div className="p-8 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">当前余额</p>
          <p className="text-5xl font-bold text-blue-600">{balance}</p>
          <p className="text-sm text-gray-400 mt-2">额度（张）</p>
        </div>
      )}

      {/* 额度说明 */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-600 dark:text-gray-300">
        <p className="font-medium mb-2">额度消耗规则：</p>
        <ul className="list-disc list-inside space-y-1">
          <li>低质量：1 额度/张</li>
          <li>中质量：2 额度/张</li>
          <li>高质量：5 额度/张</li>
          <li>生图失败自动退还额度</li>
        </ul>
      </div>

      {/* 变动记录 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">变动记录</h2>
        <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">时间</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">类型</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">说明</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">变动</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">余额</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-10 ml-auto" /></td>
                    </tr>
                  ))
                : logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-gray-500">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3">{REASON_LABELS[log.reason] || log.reason}</td>
                      <td className="px-4 py-3 text-gray-500">{log.description || "-"}</td>
                      <td className={`px-4 py-3 text-right font-medium ${log.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                        {log.delta > 0 ? "+" : ""}{log.delta}
                      </td>
                      <td className="px-4 py-3 text-right">{log.balanceAfter}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-md border text-sm disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-md border text-sm disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}