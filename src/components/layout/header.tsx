// src/components/layout/header.tsx
// 顶栏：用户信息 + 额度显示 + 主题切换
"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    creditsBalance: number;
  };
}

export function Header({ user }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 避免 SSR hydration mismatch
  useEffect(() => setMounted(true), []);

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-4">
        {/* 额度显示 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          额度余额：
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {user.creditsBalance}
          </span>
        </div>

        {/* 主题切换 */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="切换主题"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {/* 用户菜单 */}
        <div className="flex items-center gap-3">
          {user.image && (
            <img
              src={user.image}
              alt={user.name || ""}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm font-medium dark:text-gray-200">
            {user.name || user.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}
