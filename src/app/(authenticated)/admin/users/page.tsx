// src/app/(authenticated)/admin/users/page.tsx
// 管理后台 - 用户管理
"use client";

import { useEffect, useState, useRef } from "react";
import { formatDate } from "@/lib/utils";

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: string;
  creditsBalance: number;
  generationCount: number;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 充值弹窗状态
  const [grantUserId, setGrantUserId] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState(100);
  const [granting, setGranting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.data);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, debouncedSearch]);

  const handleGrant = async () => {
    if (!grantUserId || grantAmount <= 0) return;
    setGranting(true);
    try {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: grantUserId, amount: grantAmount }),
      });
      setGrantUserId(null);
      fetchUsers();
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">用户管理</h1>

      {/* 搜索 */}
      <div>
        <input
          type="text"
          placeholder="搜索用户名或邮箱..."
          value={search}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            setPage(1);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
          }}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* 用户列表 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">用户</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">角色</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">额度余额</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">生成次数</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">注册时间</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-800">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{user.name || "-"}</p>
                  <p className="text-gray-500 text-xs">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {user.role === "ADMIN" ? "管理员" : "用户"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {user.creditsBalance}
                </td>
                <td className="px-4 py-3 text-right">{user.generationCount}</td>
                <td className="px-4 py-3 text-gray-500">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setGrantUserId(user.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    充值
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-md border text-sm disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-md border text-sm disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}

      {/* 充值弹窗 */}
      {grantUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">充值额度</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  充值数量
                </label>
                <input
                  type="number"
                  min={1}
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setGrantUserId(null)}
                  className="px-4 py-2 rounded-md border text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleGrant}
                  disabled={granting || grantAmount <= 0}
                  className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm disabled:opacity-50"
                >
                  {granting ? "充值中..." : "确认充值"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
