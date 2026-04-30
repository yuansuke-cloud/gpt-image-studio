// src/app/(authenticated)/layout.tsx
// 已登录用户的布局：侧边栏 + 顶栏
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 */}
      <Sidebar user={session.user} />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        <Header user={session.user} />
        <main className="flex-1 p-6 bg-gray-50 dark:bg-gray-950 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
