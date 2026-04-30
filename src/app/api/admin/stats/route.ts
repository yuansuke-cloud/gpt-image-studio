// src/app/api/admin/stats/route.ts
// 管理后台：全局统计
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalGenerations,
    totalImages,
    totalCreditsUsed,
    todayGenerations,
    todayCostResult,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.generation.count(),
    prisma.image.count(),
    prisma.creditLog.aggregate({
      where: { delta: { lt: 0 } },
      _sum: { delta: true },
    }),
    prisma.generation.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.generation.aggregate({
      where: { createdAt: { gte: todayStart } },
      _sum: { costUsd: true },
    }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalGenerations,
    totalImages,
    totalCreditsUsed: Math.abs(totalCreditsUsed._sum.delta || 0),
    todayGenerations,
    todayCost: todayCostResult._sum.costUsd || 0,
  });
}
