// prisma/seed.ts
// 初始化种子数据：创建管理员账号
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmails = (process.env.ADMIN_EMAILS || "admin@example.com").split(",");

  for (const email of adminEmails) {
    const trimmed = email.trim();
    await prisma.user.upsert({
      where: { email: trimmed },
      update: { role: "ADMIN" },
      create: {
        email: trimmed,
        name: "Admin",
        role: "ADMIN",
        creditsBalance: 99999,
      },
    });
    console.log(`Admin user ensured: ${trimmed}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
