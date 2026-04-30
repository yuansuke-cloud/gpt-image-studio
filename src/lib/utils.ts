// src/lib/utils.ts
// 通用工具函数
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class 合并 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 格式化日期 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** 尺寸枚举转可读字符串 */
export function sizeEnumToString(size: string): string {
  const map: Record<string, string> = {
    S_1024x1024: "1024×1024",
    S_1024x1536: "1024×1536",
    S_1536x1024: "1536×1024",
    S_AUTO: "自动",
  };
  return map[size] || size;
}

/** 质量枚举转中文 */
export function qualityToLabel(quality: string): string {
  const map: Record<string, string> = {
    LOW: "低",
    MEDIUM: "中",
    HIGH: "高",
    AUTO: "自动",
  };
  return map[quality] || quality;
}

/** 状态枚举转中文 */
export function statusToLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "排队中",
    PROCESSING: "生成中",
    COMPLETED: "已完成",
    FAILED: "失败",
  };
  return map[status] || status;
}

/** 文件大小格式化 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
