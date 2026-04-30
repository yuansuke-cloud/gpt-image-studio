// src/middleware.ts
// Next.js 中间件：认证保护 + API 限速
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // 管理后台路由：仅 ADMIN 可访问
    if (req.nextUrl.pathname.startsWith("/admin")) {
      if (req.nextauth.token?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// 需要认证的路由
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/generate/:path*",
    "/history/:path*",
    "/admin/:path*",
    "/api/generate/:path*",
    "/api/history/:path*",
    "/api/credits/:path*",
    "/api/upload/:path*",
    "/api/admin/:path*",
  ],
};
