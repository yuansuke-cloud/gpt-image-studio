// src/app/page.tsx
// 首页 - 未登录展示介绍，已登录跳转 dashboard
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-3xl mx-auto text-center px-6">
        {/* Logo / 标题 */}
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          GPT Image Studio
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          基于 GPT-image-1 的 AI 图片生成平台
          <br />
          支持文生图、图生图、透明背景、多种尺寸和质量档位
        </p>

        {/* 功能亮点 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-lg border bg-white shadow-sm">
            <h3 className="font-semibold text-lg mb-2">文字生图</h3>
            <p className="text-gray-500 text-sm">
              输入描述，AI 自动生成高质量图片
            </p>
          </div>
          <div className="p-6 rounded-lg border bg-white shadow-sm">
            <h3 className="font-semibold text-lg mb-2">图片编辑</h3>
            <p className="text-gray-500 text-sm">
              上传参考图，基于描述进行智能编辑
            </p>
          </div>
          <div className="p-6 rounded-lg border bg-white shadow-sm">
            <h3 className="font-semibold text-lg mb-2">批量管理</h3>
            <p className="text-gray-500 text-sm">
              历史记录、额度管理、多用户协作
            </p>
          </div>
        </div>

        {/* 登录按钮 */}
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-8 py-3 text-base font-medium text-white hover:bg-gray-800 transition-colors"
        >
          开始使用
        </Link>
      </div>
    </main>
  );
}
