// src/app/api/upload/route.ts
// 上传参考图
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadReferenceImage } from "@/lib/storage";

// 允许的图片类型
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "不支持的文件类型，仅支持 PNG/JPEG/WebP/GIF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "文件大小不能超过 10MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { storageKey, url } = await uploadReferenceImage(buffer, {
    userId: session.user.id,
    filename: file.name,
    contentType: file.type,
  });

  const refImage = await prisma.referenceImage.create({
    data: {
      userId: session.user.id,
      storageKey,
      url,
      filename: file.name,
      fileSize: file.size,
    },
  });

  return NextResponse.json({
    id: refImage.id,
    url: refImage.url,
    filename: refImage.filename,
  });
}
