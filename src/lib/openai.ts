// src/lib/openai.ts
// OpenAI 客户端封装 - GPT Image 生成
import OpenAI from "openai";

const hasApiKey = !!process.env.OPENAI_API_KEY;

export const openai = hasApiKey
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : (null as unknown as OpenAI);

// 质量档位对应的单价（美元，基于 1024x1024）
export const QUALITY_PRICING: Record<string, Record<string, number>> = {
  "gpt-image-1": {
    low: 0.011,
    medium: 0.042,
    high: 0.167,
    auto: 0.042,
  },
};

// 尺寸对应的价格倍率
export const SIZE_MULTIPLIER: Record<string, number> = {
  "1024x1024": 1,
  "1024x1536": 1.5,
  "1536x1024": 1.5,
  auto: 1,
};

// 质量档位对应的额度消耗（张数）
export const QUALITY_CREDITS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 5,
  auto: 2,
};

export type GenerateImageParams = {
  prompt: string;
  quality?: "low" | "medium" | "high" | "auto";
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  n?: number;
  format?: "png" | "jpeg" | "webp";
  background?: "auto" | "transparent" | "opaque";
};

/**
 * 生成 Mock 占位图 SVG（base64 编码）
 */
function generateMockImage(prompt: string, index: number): string {
  const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981"];
  const bg = colors[index % colors.length];
  const truncatedPrompt =
    prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;

  // 将特殊字符转义用于 SVG
  const safePrompt = truncatedPrompt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${bg}" rx="16"/>
  <text x="512" y="420" text-anchor="middle" fill="white" font-size="48" font-family="sans-serif" font-weight="bold">Mock Image #${index + 1}</text>
  <text x="512" y="500" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="28" font-family="sans-serif">${safePrompt}</text>
  <text x="512" y="620" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="24" font-family="sans-serif">DEV MODE - No OpenAI API Key</text>
</svg>`;

  return Buffer.from(svg).toString("base64");
}

/**
 * 调用 OpenAI 生成图片
 * 返回 base64 编码的图片数据数组
 */
export async function generateImages(params: GenerateImageParams) {
  const {
    prompt,
    quality = "medium",
    size = "1024x1024",
    n = 1,
    format = "png",
    background = "auto",
  } = params;

  // Mock 模式：无 API Key 时返回占位图
  if (!hasApiKey) {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
    return Array.from({ length: n }, (_, i) => ({
      b64_data: generateMockImage(prompt, i),
      revised_prompt: `[Mock] ${prompt}`,
    }));
  }

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    quality,
    size,
    n,
    // @ts-ignore output_format 在新版 SDK 中可能还没有类型
    output_format: format === "png" ? "png" : format === "webp" ? "webp" : "jpeg",
    background,
  });

  return response.data!.map((img) => ({
    b64_data: img.b64_json,
    revised_prompt: img.revised_prompt,
  }));
}

/**
 * 调用 OpenAI 编辑图片（基于参考图）
 */
export async function editImage(params: {
  prompt: string;
  imageBuffer: Buffer;
  quality?: "low" | "medium" | "high" | "auto";
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  format?: "png" | "jpeg" | "webp";
}) {
  const { prompt, imageBuffer, quality = "medium", size = "1024x1024", format = "png" } = params;

  // Mock 模式
  if (!hasApiKey) {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
    return [
      {
        b64_data: generateMockImage(`[Edit] ${prompt}`, 0),
        revised_prompt: `[Mock Edit] ${prompt}`,
      },
    ];
  }

  const file = new File([new Uint8Array(imageBuffer)], "reference.png", { type: "image/png" });

  const response = await openai.images.edit({
    model: "gpt-image-1",
    prompt,
    image: file,
    quality,
    size,
  });

  return response.data!.map((img) => ({
    b64_data: img.b64_json,
    revised_prompt: img.revised_prompt,
  }));
}

/**
 * 计算本次生图的美元成本
 */
export function calculateCost(
  quality: string,
  size: string,
  n: number,
  model: string = "gpt-image-1"
): number {
  const basePrice = QUALITY_PRICING[model]?.[quality] ?? QUALITY_PRICING["gpt-image-1"].medium;
  const sizeKey = size.replace("S_", "").toLowerCase();
  const multiplier = SIZE_MULTIPLIER[sizeKey] ?? 1;
  return basePrice * multiplier * n;
}

/**
 * 计算本次生图的额度消耗
 */
export function calculateCredits(quality: string, n: number): number {
  const perImage = QUALITY_CREDITS[quality] ?? QUALITY_CREDITS.medium;
  return perImage * n;
}
