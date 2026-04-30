// src/lib/rate-limit.ts
// 基于 Upstash Redis 的速率限制
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 如果没有配置 Upstash，使用内存模式（仅开发环境）
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : undefined;

/**
 * 生图接口限速：每用户每分钟最多 10 次请求
 */
export const generateRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "ratelimit:generate",
    })
  : null;

/**
 * 通用 API 限速：每 IP 每分钟最多 60 次请求
 */
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      analytics: true,
      prefix: "ratelimit:api",
    })
  : null;

/**
 * 检查速率限制
 * @returns true 表示允许通过，false 表示被限速
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (!limiter) {
    // 没有配置 Redis，开发环境放行
    return { success: true, remaining: 999, reset: 0 };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
