import OpenAI from "openai";

const API_BASE_URL = process.env.OPENAI_API_BASE_URL || "https://api.apimart.ai";
const API_KEY = process.env.OPENAI_API_KEY || "";

const hasApiKey = !!API_KEY;

export const openai = hasApiKey
  ? new OpenAI({ apiKey: API_KEY, baseURL: `${API_BASE_URL}/v1` })
  : (null as unknown as OpenAI);

const QUALITY_PRICING: Record<string, Record<string, number>> = {
  "gpt-image-2-official": {
    low: 0.011,
    medium: 0.042,
    high: 0.167,
    auto: 0.042,
  },
};

export const SIZE_MULTIPLIER: Record<string, number> = {
  "1024x1024": 1,
  "1024x1536": 1.5,
  "1536x1024": 1.5,
  auto: 1,
};

export const QUALITY_CREDITS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 5,
  auto: 2,
};

export type GenerateImageParams = {
  prompt: string;
  quality?: "low" | "medium" | "high" | "auto";
  size?: string;
  resolution?: "1k" | "2k" | "4k";
  n?: number;
  format?: "png" | "jpeg" | "webp";
  background?: "auto" | "transparent" | "opaque";
  imageUrls?: string[];
  maskUrl?: string;
};

function generateMockImage(prompt: string, index: number): string {
  const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981"];
  const bg = colors[index % colors.length];
  const truncatedPrompt = prompt.length > 60 ? prompt.slice(0, 57) + "..." : prompt;
  const safePrompt = truncatedPrompt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${bg}" rx="16"/>
  <text x="512" y="420" text-anchor="middle" fill="white" font-size="48" font-family="sans-serif" font-weight="bold">Mock Image #${index + 1}</text>
  <text x="512" y="500" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="28" font-family="sans-serif">${safePrompt}</text>
  <text x="512" y="620" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="24" font-family="sans-serif">DEV MODE - No API Key</text>
</svg>`;
  return Buffer.from(svg).toString("base64");
}

function sizeToAspect(size: string): string {
  const map: Record<string, string> = {
    "1024x1024": "1:1",
    "1024x1536": "2:3",
    "1536x1024": "3:2",
  };
  return map[size] || "auto";
}

export async function generateImages(params: GenerateImageParams) {
  const { prompt, quality = "medium", size, resolution = "1k", n = 1, format = "png", background = "auto", imageUrls, maskUrl } = params;

  if (!hasApiKey) {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
    return Array.from({ length: n }, (_, i) => ({ b64_data: generateMockImage(prompt, i), revised_prompt: `[Mock] ${prompt}` }));
  }

  const aspect = sizeToAspect(size || "1024x1024");

  const body: Record<string, any> = {
    model: "gpt-image-2-official",
    prompt,
    quality,
    n,
    output_format: format,
    background,
    resolution,
  };

  if (aspect && aspect !== "auto") body.size = aspect;
  else body.size = "auto";

  if (imageUrls?.length) body.image_urls = imageUrls;
  if (maskUrl) body.mask_url = maskUrl;

  const submitRes = await fetch(`${API_BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const errBody = await submitRes.text();
    let errMsg = "图片生成请求失败";
    try {
      const parsed = JSON.parse(errBody);
      errMsg = parsed.message || parsed.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const submitData = await submitRes.json();
  const taskId = submitData?.data?.id;
  if (!taskId) throw new Error("提交成功但未获取到 task_id");

  // 轮询任务结果
  const maxWait = 180_000;
  const pollInterval = 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollRes = await fetch(`${API_BASE_URL}/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status = pollData?.data?.status;

    if (status === "completed") {
      const images = pollData.data.result?.images || [];
      return images.map((img: any) => ({
        b64_data: "",
        url: img.url?.[0] || "",
        revised_prompt: prompt,
      }));
    }

    if (status === "failed") {
      throw new Error(pollData.data?.error || "图片生成失败");
    }
  }

  throw new Error("图片生成超时，请降低质量档位或减少数量");
}

export function calculateCost(quality: string, size: string, n: number, model: string = "gpt-image-2-official"): number {
  const basePrice = QUALITY_PRICING[model]?.[quality] ?? QUALITY_PRICING["gpt-image-2-official"].medium;
  const sizeKey = size.replace("S_", "").toLowerCase();
  const multiplier = SIZE_MULTIPLIER[sizeKey] ?? 1;
  return basePrice * multiplier * n;
}

export function calculateCredits(quality: string, n: number): number {
  const perImage = QUALITY_CREDITS[quality] ?? QUALITY_CREDITS.medium;
  return perImage * n;
}
