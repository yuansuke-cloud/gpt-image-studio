// src/app/api/download/[id]/route.ts
// 图片下载代理 — 绕过跨域限制，设置 Content-Disposition
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFromStorage } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 查找图片记录，确认属于当前用户
  const image = await prisma.image.findFirst({
    where: {
      id: params.id,
      generation: { userId: session.user.id },
    },
    select: { storageKey: true, format: true },
  });

  if (!image) {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }

  const file = await getFromStorage(image.storageKey);
  if (!file) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const filename = `image-${params.id}.${image.format || "png"}`;

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(file.buffer.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
