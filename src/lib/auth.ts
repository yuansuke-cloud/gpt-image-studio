// src/lib/auth.ts
// NextAuth 配置
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

const isDevMode = process.env.DEV_MODE === "true";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    // 开发模式：邮箱直接登录
    ...(isDevMode
      ? [
          CredentialsProvider({
            name: "邮箱登录（开发模式）",
            credentials: {
              email: { label: "邮箱", type: "email", placeholder: "admin@local.test" },
            },
            async authorize(credentials, req) {
              if (!credentials?.email) return null;
              const email = credentials.email.trim().toLowerCase();

              const user = await prisma.user.findUnique({ where: { email } });
              if (!user) {
                throw new Error("邮箱未注册，请联系管理员");
              }

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              };
            },
          }),
        ]
      : []),
    // GitHub OAuth
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // JWT 模式下，首次登录时将用户信息写入 token
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        if (isDevMode) {
          // JWT 模式：从 token 获取 id，从数据库获取最新角色和额度
          session.user.id = token.id as string;
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, creditsBalance: true },
          });
          if (dbUser) {
            session.user.role = dbUser.role as any;
            session.user.creditsBalance = dbUser.creditsBalance;
          }
        } else {
          // Database 模式：从 user 对象获取
          session.user.id = user.id;
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, creditsBalance: true },
          });
          if (dbUser) {
            session.user.role = dbUser.role as any;
            session.user.creditsBalance = dbUser.creditsBalance;
          }
        }
      }
      return session;
    },
  },
  events: {
    // 新用户注册时赠送初始额度（OAuth 模式）
    async createUser({ user }) {
      const defaultCredits = parseInt(process.env.DEFAULT_USER_CREDITS || "50");
      await prisma.creditLog.create({
        data: {
          userId: user.id,
          delta: defaultCredits,
          balanceAfter: defaultCredits,
          reason: "INITIAL_GRANT",
          description: "注册赠送额度",
        },
      });
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    // Credentials provider 不支持 database strategy，开发模式用 JWT
    strategy: isDevMode ? "jwt" : "database",
  },
};
