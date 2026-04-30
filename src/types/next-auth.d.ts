// src/types/next-auth.d.ts
// 扩展 NextAuth 类型定义
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      creditsBalance: number;
    } & DefaultSession["user"];
  }
}
