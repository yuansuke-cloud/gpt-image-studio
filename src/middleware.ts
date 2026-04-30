import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function ip4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [rangeIp, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  return (ip4ToInt(ip) & mask) === (ip4ToInt(rangeIp) & mask);
}

const ALLOWED_CIDRS = ["192.168.2.0/24", "192.168.3.0/24"];

// 本地开发 / Vercel 代理下不限制
const BYPASS_IPS = ["::1", "127.0.0.1", "0.0.0.0"];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;

    if (token?.role === "ADMIN") {
      return NextResponse.next();
    }

    // 优先使用平台可信头，Vercel 会设置 x-vercel-forwarded-for
    // 其次取 x-forwarded-for 最右侧 IP（最后一个代理添加的，较难伪造）
    const vercelIp = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    const forwarded = req.headers.get("x-forwarded-for") || "";
    const forwardedParts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    const rightmostForwarded = forwardedParts[forwardedParts.length - 1] || "";
    const realIp = req.headers.get("x-real-ip") || "";
    const ip = vercelIp || rightmostForwarded || realIp || "";

    if (!ip || BYPASS_IPS.includes(ip)) {
      return NextResponse.next();
    }

    const allowed = ALLOWED_CIDRS.some((cidr) => ipInCidr(ip, cidr));
    if (!allowed) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "ip_restricted");
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

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
