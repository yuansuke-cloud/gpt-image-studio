// src/components/ui/image-lightbox.tsx
// 图片 Lightbox 组件 - 点击放大查看
"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Download } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  imageId?: string; // 传入后使用 /api/download 代理下载
  children: React.ReactNode; // 触发元素（缩略图）
}

export function ImageLightbox({ src, alt = "图片", imageId, children }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const downloadUrl = imageId ? `/api/download/${imageId}` : src;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="cursor-zoom-in w-full text-left">
          {children}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
          {/* 顶部操作栏 */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <a
              href={downloadUrl}
              download
              className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-5 h-5" />
            </a>
            <Dialog.Close className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {/* 图片 */}
          <Dialog.Close className="max-w-full max-h-full">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
