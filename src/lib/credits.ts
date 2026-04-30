// src/lib/credits.ts
// 额度管理服务
import { prisma } from "./prisma";
import { calculateCredits } from "./openai";

/**
 * 扣除额度（生图成功后调用）
 */
export async function deductCredits(
  userId: string,
  cost: number,
  generationId: string
): Promise<number | null> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });

    if (!user || user.creditsBalance < cost) {
      return null;
    }

    const newBalance = user.creditsBalance - cost;

    await tx.user.update({
      where: { id: userId },
      data: { creditsBalance: newBalance },
    });

    await tx.creditLog.create({
      data: {
        userId,
        delta: -cost,
        balanceAfter: newBalance,
        reason: "GENERATION",
        description: `生图消耗 ${cost} 额度`,
        generationId,
      },
    });

    return newBalance;
  });
}

/**
 * 退还额度（生图失败时调用）
 */
export async function refundCredits(
  userId: string,
  quality: string,
  n: number,
  generationId: string
): Promise<void> {
  const refund = calculateCredits(quality, n);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });

    if (!user) return;

    const newBalance = user.creditsBalance + refund;

    await tx.user.update({
      where: { id: userId },
      data: { creditsBalance: newBalance },
    });

    await tx.creditLog.create({
      data: {
        userId,
        delta: refund,
        balanceAfter: newBalance,
        reason: "REFUND",
        description: `生图失败退还 ${refund} 额度`,
        generationId,
      },
    });
  });
}

/**
 * 管理员充值额度
 */
export async function grantCredits(
  userId: string,
  amount: number,
  adminId: string
): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditsBalance: true },
    });

    const newBalance = user.creditsBalance + amount;

    await tx.user.update({
      where: { id: userId },
      data: { creditsBalance: newBalance },
    });

    await tx.creditLog.create({
      data: {
        userId,
        delta: amount,
        balanceAfter: newBalance,
        reason: "ADMIN_GRANT",
        description: `管理员 ${adminId} 充值 ${amount} 额度`,
      },
    });

    return newBalance;
  });
}
