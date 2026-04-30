// src/app/api/history/[id]/route.ts
// 获取单条生图记录详情
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromStorage } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const generation = await prisma.generation.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    include: {
      images: true,
      referenceImage: { select: { id: true, url: true, filename: true } },
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  return NextResponse.json(generation);
}

// 删除单条记录
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const generation = await prisma.generation.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!generation) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  // 查出关联的图片，用于清理存储文件
  const images = await prisma.image.findMany({
    where: { generationId: params.id },
    select: { storageKey: true },
  });

  // 级联删除数据库记录
  await prisma.generation.delete({ where: { id: params.id } });

  // 异步清理存储文件（不阻塞响应）
  for (const img of images) {
    deleteFromStorage(img.storageKey).catch((err) =>
      console.error("Failed to delete storage file:", img.storageKey, err)
    );
  }

  return NextResponse.json({ success: true });
}
