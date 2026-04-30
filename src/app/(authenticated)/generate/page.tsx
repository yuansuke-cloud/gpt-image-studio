// src/app/(authenticated)/generate/page.tsx
// 生图页面 - 核心功能页
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDropzone } from "react-dropzone";
import type { GenerateRequest, GenerateResponse, GeneratedImage } from "@/types";
import { ImageLightbox } from "@/components/ui/image-lightbox";

const QUALITY_OPTIONS = [
  { value: "low", label: "低质量", desc: "1 额度/张，速度快", credits: 1 },
  { value: "medium", label: "中质量", desc: "2 额度/张，推荐", credits: 2 },
  { value: "high", label: "高质量", desc: "5 额度/张，最佳效果", credits: 5 },
];

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "1024×1024", desc: "正方形" },
  { value: "1024x1536", label: "1024×1536", desc: "竖版" },
  { value: "1536x1024", label: "1536×1024", desc: "横版" },
];

const FORMAT_OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

const POLL_INTERVAL = 1500; // 轮询间隔 ms

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();

  // 表单状态
  const [prompt, setPrompt] = useState(searchParams.get("prompt") || "");
  const [quality, setQuality] = useState("medium");
  const [size, setSize] = useState("1024x1024");
  const [n, setN] = useState(1);
  const [format, setFormat] = useState("png");
  const [background, setBackground] = useState("auto");

  // 参考图
  const [referenceImage, setReferenceImage] = useState<{
    id: string;
    url: string;
    filename: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // 轮询生图状态
  const startPolling = useCallback((generationId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/history/${generationId}`);
        if (!res.ok) return;
        const data = await res.json();

        setGenerationStatus(data.status);

        if (data.status === "COMPLETED") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setGenerating(false);
          // 刷新 session 获取最新余额
          updateSession();
          setResult({
            generationId: data.id,
            status: "COMPLETED",
            images: data.images?.map((img: any) => ({
              id: img.id,
              url: img.url,
              format: img.format,
            })) || [],
            creditsUsed: data.costCredits ?? 0,
            creditsRemaining: 0, // 由 session 提供实时余额
          });
        } else if (data.status === "FAILED") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setGenerating(false);
          setError(data.error || "生成失败");
        }
      } catch {
        // 网络错误时继续轮询
      }
    }, POLL_INTERVAL);
  }, [updateSession]);

  // 参考图上传
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "上传失败");
      }
      const data = await res.json();
      setReferenceImage(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  // 预估额度
  const estimatedCost = (QUALITY_OPTIONS.find((q) => q.value === quality)?.credits ?? 2) * n;
  const currentBalance = session?.user?.creditsBalance ?? 0;
  const insufficientCredits = currentBalance < estimatedCost;

  // 提交生图
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("请输入图片描述");
      return;
    }

    if (insufficientCredits) {
      setError(`额度不足，需要 ${estimatedCost} 额度，当前余额 ${currentBalance}`);
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);
    setGenerationStatus("PENDING");

    try {
      const body: GenerateRequest = {
        prompt: prompt.trim(),
        quality: quality as any,
        size: size as any,
        n,
        format: format as any,
        background: background as any,
        referenceImageId: referenceImage?.id,
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "生成失败");
      }

      // API 立即返回，开始轮询
      startPolling(data.generationId);
    } catch (err: any) {
      setError(err.message);
      setGenerating(false);
    }
  };

  const statusLabel: Record<string, string> = {
    PENDING: "排队中...",
    PROCESSING: "生成中...",
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">生成图片</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：参数面板 */}
        <div className="lg:col-span-1 space-y-6">
          {/* Prompt 输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              图片描述
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要生成的图片..."
              rows={5}
              maxLength={4000}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{prompt.length}/4000</p>
          </div>

          {/* 参考图上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              参考图（可选，用于编辑模式）
            </label>
            {referenceImage ? (
              <div className="relative">
                <img src={referenceImage.url} alt="参考图" className="w-full rounded-md border" />
                <button
                  onClick={() => setReferenceImage(null)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-gray-900 bg-gray-50" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <p className="text-sm text-gray-500">上传中...</p>
                ) : (
                  <p className="text-sm text-gray-500">拖拽图片到此处，或点击选择</p>
                )}
              </div>
            )}
          </div>

          {/* 质量选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">质量</label>
            <div className="space-y-2">
              {QUALITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    quality === opt.value ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input type="radio" name="quality" value={opt.value} checked={quality === opt.value} onChange={(e) => setQuality(e.target.value)} className="sr-only" />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 尺寸选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">尺寸</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label} ({opt.desc})</option>
              ))}
            </select>
          </div>

          {/* 数量 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">数量（1-4）</label>
            <input type="number" min={1} max={4} value={n} onChange={(e) => setN(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>

          {/* 格式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">格式</label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setFormat(opt.value)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${format === opt.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 背景 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">背景</label>
            <select value={background} onChange={(e) => setBackground(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="auto">自动</option>
              <option value="transparent">透明（仅 PNG/WebP）</option>
              <option value="opaque">不透明</option>
            </select>
          </div>

          {/* 预估消耗 */}
          <div className={`p-4 rounded-md ${insufficientCredits ? "bg-red-50" : "bg-blue-50"}`}>
            <p className={`text-sm ${insufficientCredits ? "text-red-800" : "text-blue-800"}`}>
              预估消耗：<span className="font-semibold">{estimatedCost} 额度</span>
              <span className="ml-2">（余额 {currentBalance}）</span>
            </p>
            {insufficientCredits && (
              <p className="text-xs text-red-600 mt-1">额度不足，请充值后再试</p>
            )}
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || insufficientCredits}
            className="w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? "生成中..." : insufficientCredits ? "额度不足" : "开始生成"}
          </button>
        </div>

        {/* 右侧：结果展示 */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {generating && (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">{statusLabel[generationStatus] || "准备中..."}</p>
              </div>
            </div>
          )}

          {result?.images && result.images.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  消耗 {result.creditsUsed} 额度，剩余 {session?.user?.creditsBalance ?? 0}
                </p>
              </div>
              <div className={`grid gap-4 ${result.images.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
                {result.images.map((img) => (
                  <div key={img.id} className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden">
                    <ImageLightbox src={img.url} alt={prompt}>
                      <img src={img.url} alt={prompt} className="w-full" />
                    </ImageLightbox>
                    <div className="p-3 flex justify-end gap-2">
                      <a href={img.url} download target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800">
                        下载
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!generating && !result && !error && (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800">
              <p className="text-gray-400 dark:text-gray-500">输入描述并点击生成，图片将在这里展示</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
