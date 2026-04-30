// src/app/api/generate/route.ts
// 核心接口：生成图片（异步模式）
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateImages, editImage, calculateCost, calculateCredits } from "@/lib/openai";
import { uploadBase64Image } from "@/lib/storage";
import { deductCredits, refundCredits } from "@/lib/credits";
import { checkRateLimit, generateRateLimit } from "@/lib/rate-limit";
import type { GenerateRequest } from "@/types";
import fsPromises from "fs/promises";
import path from "path";

/**
 * 后台执行生图任务（fire-and-forget）
 */
async function processGeneration(params: {
  generationId: string;
  userId: string;
  prompt: string;
  quality: string;
  size: string;
  n: number;
  format: string;
  background: string;
  referenceImageId?: string | null;
}) {
  const {
    generationId, userId, prompt, quality, size,
    n, format, background, referenceImageId,
  } = params;

  try {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    let results;
    if (referenceImageId) {
      const refImage = await prisma.referenceImage.findUnique({
        where: { id: referenceImageId },
      });
      if (!refImage) throw new Error("参考图不存在");

      let refBuffer: Buffer;
      if (refImage.url.startsWith("/uploads/")) {
        const localPath = path.join(process.cwd(), "public", refImage.url);
        refBuffer = await fsPromises.readFile(localPath);
      } else {
        const refResponse = await fetch(refImage.url);
        refBuffer = Buffer.from(await refResponse.arrayBuffer());
      }

      results = await editImage({
        prompt,
        imageBuffer: refBuffer,
        quality: quality as any,
        size: size as any,
        format: format as any,
      });
    } else {
      results = await generateImages({
        prompt,
        quality: quality as any,
        size: size as any,
        n,
        format: format as any,
        background: background as any,
      });
    }

    // 上传图片并保存记录
    for (const result of results) {
      if (result.b64_data) {
        const { storageKey, url } = await uploadBase64Image(result.b64_data, {
          userId,
          format,
        });
        await prisma.image.create({
          data: { generationId, storageKey, url, format },
        });
      }
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } catch (err: any) {
    console.error("Background generation failed:", err);
    await refundCredits(userId, quality, n, generationId).catch(console.error);

    const errorMap: Record<string, string> = {
      content_policy_violation: "图片内容违反安全策略，请修改描述后重试",
      rate_limit_exceeded: "API 调用过于频繁，请稍后重试",
      insufficient_quota: "API 额度不足，请联系管理员",
      bad_request: "请求参数有误，请检查输入",
      timeout: "生成超时，请降低质量档位或减少数量",
    };
    const userMessage = errorMap[err.code] || err.message || "生成失败";

    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "FAILED", error: userMessage },
    }).catch(console.error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. 认证检查
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. 速率限制
    const rateCheck = await checkRateLimit(generateRateLimit, userId);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试", retryAfter: rateCheck.reset },
        { status: 429 }
      );
    }

    // 3. 解析请求
    const body: GenerateRequest = await req.json();
    const {
      prompt,
      quality = "medium",
      size = "1024x1024",
      n = 1,
      format = "png",
      background = "auto",
      referenceImageId,
    } = body;

    // 4. 参数校验
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: "prompt 不能超过 4000 字符" }, { status: 400 });
    }
    if (n < 1 || n > 4) {
      return NextResponse.json({ error: "n 必须在 1-4 之间" }, { status: 400 });
    }

    // 5. 创建生图任务记录
    const costCredits = calculateCredits(quality, n);
    const costUsd = calculateCost(quality, size, n);

    const generation = await prisma.generation.create({
      data: {
        userId,
        prompt: prompt.trim(),
        quality: quality.toUpperCase() as any,
        size: `S_${size.replace("x", "x")}` as any,
        n,
        format: format.toUpperCase() as any,
        background: background.toUpperCase() as any,
        status: "PENDING",
        costCredits,
        costUsd,
        referenceImageId: referenceImageId || null,
      },
    });

    // 6. 预扣额度
    const newBalance = await deductCredits(userId, quality, n, generation.id);
    if (newBalance === null) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", error: "额度不足" },
      });
      return NextResponse.json(
        { error: "额度不足", creditsRequired: costCredits },
        { status: 402 }
      );
    }

    // 7. 后台异步执行生图（不阻塞响应）
    processGeneration({
      generationId: generation.id,
      userId,
      prompt: prompt.trim(),
      quality, size, n, format, background,
      referenceImageId,
    }).catch(console.error);

    // 8. 立即返回任务 ID，前端轮询状态
    return NextResponse.json({
      generationId: generation.id,
      status: "PENDING",
      creditsUsed: costCredits,
      creditsRemaining: newBalance,
    });
  } catch (error: any) {
    console.error("Generate API error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
