// src/app/api/dashboard/route.ts
// 用户仪表盘统计数据
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, totalGenerations, totalImages, creditsUsed, recentGenerations] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { creditsBalance: true },
      }),
      prisma.generation.count({ where: { userId } }),
      prisma.image.count({
        where: { generation: { userId } },
      }),
      prisma.creditLog.aggregate({
        where: { userId, delta: { lt: 0 } },
        _sum: { delta: true },
      }),
      prisma.generation.findMany({
        where: { userId },
        include: {
          images: { select: { id: true, url: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  return NextResponse.json({
    totalGenerations,
    totalImages,
    creditsUsed: Math.abs(creditsUsed._sum.delta || 0),
    creditsRemaining: user?.creditsBalance ?? 0,
    recentGenerations,
  });
}
