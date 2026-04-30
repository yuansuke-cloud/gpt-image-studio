// src/app/(authenticated)/history/page.tsx
// 历史记录页面
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, qualityToLabel, statusToLabel, sizeEnumToString } from "@/lib/utils";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface HistoryItem {
  id: string;
  prompt: string;
  quality: string;
  size: string;
  status: string;
  costCredits: number;
  createdAt: string;
  images: { id: string; url: string }[];
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?page=${p}&pageSize=12`);
      const data = await res.json();
      setItems(data.data);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page);
  }, [page]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这条记录？")) return;
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    fetchHistory(page);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">历史记录</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">还没有生成记录</p>
          <Link
            href="/generate"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 py-2 text-sm font-medium text-white"
          >
            去生成
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden"
              >
                {/* 图片预览 */}
                {item.images.length > 0 ? (
                  <ImageLightbox src={item.images[0].url} alt={item.prompt}>
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={item.images[0].url}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </ImageLightbox>
                ) : (
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">
                      {statusToLabel(item.status)}
                    </span>
                  </div>
                )}

                {/* 信息 */}
                <div className="p-4 space-y-2">
                  <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                    {item.prompt}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{qualityToLabel(item.quality)}</span>
                    <span>·</span>
                    <span>{sizeEnumToString(item.size)}</span>
                    <span>·</span>
                    <span>{item.costCredits} 额度</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {formatDate(item.createdAt)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/generate?prompt=${encodeURIComponent(item.prompt)}`)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        复用
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
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
        </>
      )}
    </div>
  );
}
