// src/lib/storage.ts
// 存储模块：支持 Cloudflare R2 和本地文件系统
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import fs from "fs/promises";

const isDevMode = process.env.DEV_MODE === "true";
const hasR2Config = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
);
const useLocalStorage = isDevMode || !hasR2Config;

// R2 客户端延迟初始化，避免缺少凭证时模块加载崩溃
let _r2Client: S3Client | null = null;
function getR2Client(): S3Client {
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _r2Client;
}

const BUCKET = process.env.R2_BUCKET_NAME || "gpt-images";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

/**
 * 确保本地目录存在
 */
async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 上传 base64 图片
 * @returns { storageKey, url }
 */
export async function uploadBase64Image(
  base64Data: string,
  options: {
    userId: string;
    format?: string;
    folder?: string;
  }
): Promise<{ storageKey: string; url: string }> {
  const { userId, format = "png", folder = "generations" } = options;
  const buffer = Buffer.from(base64Data, "base64");
  const key = `${folder}/${userId}/${Date.now()}-${crypto.randomUUID()}.${format}`;

  if (useLocalStorage) {
    // 本地文件系统模式
    const localPath = path.join(process.cwd(), "public", "uploads", key);
    await ensureDir(path.dirname(localPath));
    await fs.writeFile(localPath, buffer);
    return {
      storageKey: key,
      url: `/uploads/${key}`,
    };
  }

  // R2 模式
  const contentTypeMap: Record<string, string> = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentTypeMap[format] || "image/png",
    })
  );

  return {
    storageKey: key,
    url: `${PUBLIC_URL}/${key}`,
  };
}

/**
 * 上传用户参考图（Buffer）
 */
export async function uploadReferenceImage(
  buffer: Buffer,
  options: {
    userId: string;
    filename: string;
    contentType: string;
  }
): Promise<{ storageKey: string; url: string }> {
  const { userId, filename, contentType } = options;
  const ext = filename.split(".").pop() || "png";
  const key = `references/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  if (useLocalStorage) {
    const localPath = path.join(process.cwd(), "public", "uploads", key);
    await ensureDir(path.dirname(localPath));
    await fs.writeFile(localPath, buffer);
    return {
      storageKey: key,
      url: `/uploads/${key}`,
    };
  }

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    storageKey: key,
    url: `${PUBLIC_URL}/${key}`,
  };
}

/**
 * 删除文件
 */
export async function deleteFromStorage(storageKey: string): Promise<void> {
  if (useLocalStorage) {
    const localPath = path.join(process.cwd(), "public", "uploads", storageKey);
    try {
      await fs.unlink(localPath);
    } catch {
      // 文件不存在时忽略
    }
    return;
  }

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    })
  );
}
