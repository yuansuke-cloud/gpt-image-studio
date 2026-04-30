// src/app/api/generate/route.ts
// 核心接口：生成图片（异步模式）
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateImages, calculateCost, calculateCredits } from "@/lib/openai";
import { deductCredits } from "@/lib/credits";
import { checkRateLimit, generateRateLimit } from "@/lib/rate-limit";
import type { GenerateRequest } from "@/types";

/**
 * 后台执行生图任务（fire-and-forget）
 */
async function processGeneration(params: {
  generationId: string;
  userId: string;
  isAdmin: boolean;
  prompt: string;
  quality: string;
  size: string;
  resolution: string;
  n: number;
  format: string;
  background: string;
  referenceImageIds?: string[];
}) {
  const {
    generationId, userId, isAdmin, prompt, quality, size,
    resolution, n, format, background, referenceImageIds,
  } = params;

  try {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "PROCESSING" },
    });

    // 如果有参考图，获取图片 URL
    let imageUrls: string[] | undefined;
    if (referenceImageIds?.length) {
      const refImages = await prisma.referenceImage.findMany({
        where: { id: { in: referenceImageIds }, userId },
        select: { url: true },
      });
      imageUrls = refImages.map((r) => r.url);
    }

    const results = await generateImages({
      prompt,
      quality: quality as any,
      size: size as any,
      resolution: resolution as any,
      n,
      format: format as any,
      background: background as any,
      imageUrls,
    });

    for (const result of results) {
      const imageUrl = result.url || "";
      if (imageUrl) {
        await prisma.image.create({
          data: { generationId, storageKey: imageUrl, url: imageUrl, format },
        });
      }
    }

    const cost = calculateCredits(quality, n);

    if (isAdmin) {
      // 管理员不扣额度，直接标记完成
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: "COMPLETED", completedAt: new Date(), costCredits: 0 },
      });
    } else {
      const newBalance = await deductCredits(userId, cost, generationId);

      if (newBalance === null) {
        // 额度不足，清理已生成的图片记录并标记失败
        await prisma.image.deleteMany({ where: { generationId } });
        await prisma.generation.update({
          where: { id: generationId },
          data: { status: "FAILED", error: "额度不足，请充值后重试", costCredits: 0 },
        });
        return;
      }

      await prisma.generation.update({
        where: { id: generationId },
        data: { status: "COMPLETED", completedAt: new Date(), costCredits: cost },
      });
    }
  } catch (err: any) {
    console.error("Background generation failed:", err);

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
      data: { status: "FAILED", error: userMessage, costCredits: 0 },
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
    const isAdmin = session.user.role === "ADMIN";

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
      resolution = "1k",
      n = 1,
      format = "png",
      background = "auto",
      referenceImageIds,
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

    // 5. 余额预检（管理员跳过）
    const costCredits = calculateCredits(quality, n);
    if (!isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditsBalance: true },
      });
      if (!user || user.creditsBalance < costCredits) {
        return NextResponse.json(
          { error: `额度不足，需要 ${costCredits} 额度，当前余额 ${user?.creditsBalance ?? 0}` },
          { status: 400 }
        );
      }
    }

    // 5.5 校验参考图（最多 5 张，且必须属于当前用户）
    let validatedRefImageIds: string[] | undefined;
    if (referenceImageIds?.length) {
      if (referenceImageIds.length > 5) {
        return NextResponse.json({ error: "参考图最多 5 张" }, { status: 400 });
      }
      const validRefImages = await prisma.referenceImage.findMany({
        where: { id: { in: referenceImageIds }, userId },
        select: { id: true },
      });
      if (validRefImages.length !== referenceImageIds.length) {
        return NextResponse.json({ error: "包含无效的参考图" }, { status: 400 });
      }
      validatedRefImageIds = validRefImages.map((r) => r.id);
    }

    // 6. 创建生图任务记录
    const costUsd = calculateCost(quality, size, n);

    const generation = await prisma.generation.create({
      data: {
        userId,
        prompt: prompt.trim(),
        quality: quality.toUpperCase() as any,
        size: `S_${size}` as any,
        n,
        format: format.toUpperCase() as any,
        background: background.toUpperCase() as any,
        status: "PENDING",
        costCredits: 0,
        costUsd,
        referenceImages: validatedRefImageIds?.length
          ? { connect: validatedRefImageIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    // 7. 后台异步执行生图（不阻塞响应），完成后再扣额度
    processGeneration({
      generationId: generation.id,
      userId,
      isAdmin,
      prompt: prompt.trim(),
      quality, size, resolution, n, format, background,
      referenceImageIds: validatedRefImageIds,
    }).catch(console.error);

    // 8. 立即返回任务 ID，前端轮询状态
    return NextResponse.json({
      generationId: generation.id,
      status: "PENDING",
      creditsUsed: costCredits,
    });
  } catch (error: any) {
    console.error("Generate API error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
