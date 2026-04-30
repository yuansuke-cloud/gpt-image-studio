// src/app/(authenticated)/generate/page.tsx
// 生图页面 - 核心功能页
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDropzone } from "react-dropzone";
import type { GenerateRequest, GenerateResponse, GeneratedImage } from "@/types";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Download } from "lucide-react";

const QUALITY_OPTIONS = [
  { value: "low", label: "低质量", desc: "1 额度/张，速度快", credits: 1 },
  { value: "medium", label: "中质量", desc: "2 额度/张，推荐", credits: 2 },
  { value: "high", label: "高质量", desc: "5 额度/张，最佳效果", credits: 5 },
];

const SIZE_OPTIONS = [
  { value: "1024x1024", label: "1024×1024", desc: "正方形" },
  { value: "1024x1536", label: "1024×1536", desc: "竖版" },
  { value: "1536x1024", label: "1536×1024", desc: "横版" },
  { value: "custom", label: "自定义", desc: "输入宽高" },
];

const FORMAT_OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

/** 自适应轮询间隔：前 7s 每 1s，7-30s 每 2s，30s+ 每 3s */
function getNextPollDelay(elapsedMs: number): number {
  if (elapsedMs < 7000) return 1000;
  if (elapsedMs < 30000) return 2000;
  return 3000;
}

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const { data: session, update: updateSession } = useSession();

  // 表单状态
  const [prompt, setPrompt] = useState(searchParams.get("prompt") || "");
  const [quality, setQuality] = useState("medium");
  const [size, setSize] = useState("1024x1024");
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  const [n, setN] = useState(1);
  const [format, setFormat] = useState("png");
  const [background, setBackground] = useState("auto");

  // 参考图（最多 5 张）
  const MAX_REF_IMAGES = 5;
  const [referenceImages, setReferenceImages] = useState<{
    id: string;
    url: string;
    filename: string;
  }[]>([]);
  const [uploading, setUploading] = useState(false);

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);

  // 耗时计时器
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 清理轮询和计时器
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 启动耗时计时器
  const startTimer = useCallback(() => {
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 自适应轮询生图状态（setTimeout 链）
  const startPolling = useCallback((generationId: string) => {
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollStartRef.current = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(`/api/history/${generationId}`);
        if (!res.ok) {
          schedulePoll();
          return;
        }
        const data = await res.json();
        setGenerationStatus(data.status);

        if (data.status === "COMPLETED") {
          pollTimeoutRef.current = null;
          setGenerating(false);
          stopTimer();
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
            creditsRemaining: 0,
          });
          // 触发入场动画
          setTimeout(() => setShowResult(true), 50);
          return;
        } else if (data.status === "FAILED") {
          pollTimeoutRef.current = null;
          setGenerating(false);
          stopTimer();
          setError(data.error || "生成失败");
          return;
        }
      } catch {
        // 网络错误时继续轮询
      }
      schedulePoll();
    };

    const schedulePoll = () => {
      const elapsedMs = Date.now() - pollStartRef.current;
      const delay = getNextPollDelay(elapsedMs);
      pollTimeoutRef.current = setTimeout(poll, delay);
    };

    // 首次立即轮询
    poll();
  }, [updateSession, stopTimer]);

  // 参考图上传（支持多选，最多 MAX_REF_IMAGES 张）
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    const remaining = MAX_REF_IMAGES - referenceImages.length;
    if (remaining <= 0) {
      setError(`最多上传 ${MAX_REF_IMAGES} 张参考图`);
      return;
    }
    const files = acceptedFiles.slice(0, remaining);
    if (files.length === 0) return;

    setUploading(true);
    const newImages: { id: string; url: string; filename: string }[] = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "上传失败");
        }
        const data = await res.json();
        newImages.push(data);
      }
      setReferenceImages((prev) => [...prev, ...newImages]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [referenceImages.length]);

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const { open, getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejected) => {
      const msg = rejected[0]?.errors[0]?.message || "格式或大小不符";
      setError(`文件被拒绝：${msg}`);
    },
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    noClick: true,
  });

  // 预估额度
  const estimatedCost = (QUALITY_OPTIONS.find((q) => q.value === quality)?.credits ?? 2) * n;
  const currentBalance = session?.user?.creditsBalance ?? 0;
  const isAdmin = session?.user?.role === "ADMIN";
  const insufficientCredits = !isAdmin && currentBalance < estimatedCost;

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
    setShowResult(false);
    setGenerationStatus("PENDING");
    startTimer();

    try {
      const actualSize = size === "custom" ? `${customWidth}x${customHeight}` : size;
      const body: GenerateRequest = {
        prompt: prompt.trim(),
        quality: quality as any,
        size: actualSize as any,
        n,
        format: format as any,
        background: background as any,
        referenceImageIds: referenceImages.map((img) => img.id),
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
      stopTimer();
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              图片描述
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要生成的图片..."
              rows={5}
              maxLength={4000}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{prompt.length}/4000</p>
          </div>

          {/* 参考图上传（最多 5 张） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              参考图（可选，最多 {MAX_REF_IMAGES} 张）
            </label>
            <div
              {...getRootProps()}
              className={`rounded-md transition-colors ${isDragActive ? "ring-2 ring-gray-400 ring-offset-2 bg-gray-50 dark:bg-gray-800/50" : ""}`}
            >
              <input {...getInputProps()} />
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: MAX_REF_IMAGES }, (_, i) => {
                  const img = referenceImages[i];
                  if (img) {
                    return (
                      <div key={img.id} className="relative aspect-square">
                        <img
                          src={img.url}
                          alt={img.filename}
                          className="w-full h-full object-cover rounded-md border dark:border-gray-700"
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeReferenceImage(img.id); }}
                          className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
                        >
                          ×
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`slot-${i}`}
                      onClick={(e) => { e.stopPropagation(); if (!uploading) open(); }}
                      className={`aspect-square border-2 border-dashed rounded-md flex items-center justify-center transition-colors ${
                        uploading
                          ? "border-gray-200 dark:border-gray-800 opacity-50 cursor-not-allowed"
                          : "border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-400 cursor-pointer"
                      }`}
                    >
                      {uploading && i === referenceImages.length ? (
                        <span className="text-xs text-gray-400">...</span>
                      ) : (
                        <span className="text-lg text-gray-400">+</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {isDragActive && (
                <p className="text-xs text-gray-500 mt-1 text-center">松开以上传</p>
              )}
            </div>
            {referenceImages.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                已上传 {referenceImages.length}/{MAX_REF_IMAGES} 张
              </p>
            )}
          </div>

          {/* 质量选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">质量</label>
            <div className="space-y-2">
              {QUALITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    quality === opt.value ? "border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-800" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">尺寸</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
              {SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label} ({opt.desc})</option>
              ))}
            </select>
            {size === "custom" && (
              <div className="flex gap-2 mt-2 items-center">
                <input
                  type="number"
                  min={256}
                  max={4096}
                  step={64}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Math.min(4096, Math.max(256, parseInt(e.target.value) || 1024)))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="宽"
                />
                <span className="text-gray-400 text-sm">×</span>
                <input
                  type="number"
                  min={256}
                  max={4096}
                  step={64}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Math.min(4096, Math.max(256, parseInt(e.target.value) || 1024)))}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="高"
                />
              </div>
            )}
          </div>

          {/* 数量 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">数量（1-4）</label>
            <input type="number" min={1} max={4} value={n} onChange={(e) => setN(Math.min(4, Math.max(1, parseInt(e.target.value) || 1)))} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          </div>

          {/* 格式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">格式</label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setFormat(opt.value)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${format === opt.value ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 背景 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">背景</label>
            <select value={background} onChange={(e) => setBackground(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
              <option value="auto">自动</option>
              <option value="transparent">透明（仅 PNG/WebP）</option>
              <option value="opaque">不透明</option>
            </select>
          </div>

          {/* 预估消耗 */}
          <div className={`p-4 rounded-md ${insufficientCredits ? "bg-red-50 dark:bg-red-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}>
            <p className={`text-sm ${insufficientCredits ? "text-red-800 dark:text-red-300" : "text-blue-800 dark:text-blue-300"}`}>
              预估消耗：<span className="font-semibold">{estimatedCost} 额度</span>
              <span className="ml-2">（余额 {currentBalance}）</span>
            </p>
            {insufficientCredits && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">额度不足，请充值后再试</p>
            )}
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || insufficientCredits}
            className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-3 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? "生成中..." : insufficientCredits ? "额度不足" : "开始生成"}
          </button>
        </div>

        {/* 右侧：结果展示 */}
        <div className="lg:col-span-2">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {generating && (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">{statusLabel[generationStatus] || "准备中..."}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  已等待 {elapsed} 秒
                </p>
              </div>
            </div>
          )}

          {result?.images && result.images.length > 0 && (
            <div
              className={`space-y-4 transition-all duration-500 ease-out ${
                showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  消耗 {result.creditsUsed} 额度，剩余 {session?.user?.creditsBalance ?? 0}
                  {elapsed > 0 && <span className="ml-2">（耗时 {elapsed} 秒）</span>}
                </p>
              </div>
              <div className={`grid gap-4 ${result.images.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
                {result.images.map((img) => (
                  <div key={img.id} className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden">
                    <ImageLightbox src={img.url} alt={prompt} imageId={img.id}>
                      <img src={img.url} alt={prompt} className="w-full" />
                    </ImageLightbox>
                    <div className="p-3 flex justify-end gap-2">
                      <a
                        href={`/api/download/${img.id}`}
                        download
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <Download className="w-4 h-4" />
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
