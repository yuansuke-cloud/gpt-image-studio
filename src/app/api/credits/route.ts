// src/app/api/credits/route.ts
// 获取当前用户额度信息和变动记录
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 50);

  const [user, logs, total] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditsBalance: true },
    }),
    prisma.creditLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.creditLog.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    balance: user?.creditsBalance ?? 0,
    logs: {
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
