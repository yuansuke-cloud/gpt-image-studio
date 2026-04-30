// src/app/(authenticated)/history/page.tsx
// 历史记录页面
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { formatDate, qualityToLabel, statusToLabel, sizeEnumToString } from "@/lib/utils";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Download } from "lucide-react";

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

interface HistoryResponse {
  data: HistoryItem[];
  totalPages: number;
}

export default function HistoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const { data, isLoading, mutate } = useSWR<HistoryResponse>(
    `/api/history?page=${page}&pageSize=12`
  );

  const items = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这条记录？")) return;

    // 乐观删除：立即从缓存移除
    const previousData = data;
    mutate(
      {
        ...data!,
        data: items.filter((item) => item.id !== id),
      },
      false
    );

    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      // 重新验证以同步服务端状态
      mutate();
    } catch {
      // 回滚
      mutate(previousData, false);
      toast({
        title: "删除失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">历史记录</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
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
                className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden transition-opacity"
              >
                {/* 图片预览 */}
                {item.images.length > 0 ? (
                  <ImageLightbox src={item.images[0].url} alt={item.prompt} imageId={item.images[0].id}>
                    <div className="aspect-square bg-gray-100 relative">
                      {item.images[0].url.startsWith("/") ? (
                        <img
                          src={item.images[0].url}
                          alt={item.prompt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Image
                          src={item.images[0].url}
                          alt={item.prompt}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      )}
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
                    <div className="flex gap-2 items-center">
                      {item.images.length > 0 && (
                        <a
                          href={`/api/download/${item.images[0].id}`}
                          download
                          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          title="下载"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
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
