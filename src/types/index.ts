// src/types/index.ts
// 全局类型定义

// ============================================
// API 请求/响应类型
// ============================================

/** 生图请求 */
export interface GenerateRequest {
  prompt: string;
  quality?: "low" | "medium" | "high" | "auto";
  size?: string;
  resolution?: "1k" | "2k" | "4k";
  n?: number;
  format?: "png" | "jpeg" | "webp";
  background?: "auto" | "transparent" | "opaque";
  referenceImageIds?: string[];
}

/** 生图响应 */
export interface GenerateResponse {
  generationId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  images?: GeneratedImage[];
  error?: string;
  creditsUsed: number;
  creditsRemaining: number;
}

/** 单张生成图片 */
export interface GeneratedImage {
  id: string;
  url: string;
  format: string;
  width?: number;
  height?: number;
}

/** 历史记录列表项 */
export interface GenerationListItem {
  id: string;
  prompt: string;
  quality: string;
  size: string;
  status: string;
  images: { id: string; url: string }[];
  costCredits: number;
  createdAt: string;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 用户信息（管理后台用） */
export interface UserInfo {
  id: string;
  name: string | null;
  email: string;
  role: string;
  creditsBalance: number;
  generationCount: number;
  createdAt: string;
}

/** 额度变动记录 */
export interface CreditLogItem {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  description: string | null;
  createdAt: string;
}

/** 管理员充值请求 */
export interface GrantCreditsRequest {
  userId: string;
  amount: number;
}

/** 统计数据 */
export interface DashboardStats {
  totalGenerations: number;
  totalImages: number;
  creditsUsed: number;
  creditsRemaining: number;
  recentGenerations: GenerationListItem[];
}

/** 管理后台统计 */
export interface AdminStats {
  totalUsers: number;
  totalGenerations: number;
  totalImages: number;
  totalCreditsUsed: number;
  todayGenerations: number;
  todayCost: number;
}
