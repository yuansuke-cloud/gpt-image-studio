// prisma/seed-users.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const users = [
  { email: "admin@aiimage.com", name: "Admin 主管理员", role: "ADMIN", credits: 99999 },
  { email: "boss@aiimage.com", name: "Boss 超级管理员", role: "ADMIN", credits: 99999 },
  { email: "designer1@aiimage.com", name: "Designer 张设计师", role: "USER", credits: 200 },
  { email: "designer2@aiimage.com", name: "Designer 李设计师", role: "USER", credits: 200 },
  { email: "marketer@aiimage.com", name: "Marketer 王运营", role: "USER", credits: 150 },
  { email: "dev@aiimage.com", name: "Developer 赵开发", role: "USER", credits: 300 },
  { email: "writer@aiimage.com", name: "Writer 刘文案", role: "USER", credits: 100 },
  { email: "creator@aiimage.com", name: "Creator 陈创作者", role: "USER", credits: 250 },
  { email: "student@aiimage.com", name: "Student 周学生", role: "USER", credits: 50 },
  { email: "vip@aiimage.com", name: "VIP 吴贵宾", role: "USER", credits: 500 },
];

async function main() {
  console.log("开始创建用户...\n");

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`⚠  [${u.email}] 已存在，更新角色和额度`);
      await prisma.user.update({
        where: { email: u.email },
        data: { role: u.role, creditsBalance: u.credits },
      });
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        creditsBalance: u.credits,
      },
    });

    await prisma.creditLog.create({
      data: {
        userId: user.id,
        delta: u.credits,
        balanceAfter: u.credits,
        reason: "INITIAL_GRANT",
        description: "初始化额度",
      },
    });

    console.log(`✅  [${u.email}] ${u.name}  ${u.role === "ADMIN" ? "👑 管理员" : "  用户"}  额度: ${u.credits}`);
  }

  console.log("\n✅ 全部用户创建完成！");
  console.log("\n📋 登录密钥（开发模式输入邮箱即可）：");
  console.log("──────────────────────────────────────");
  console.log("  👑 管理员: admin@aiimage.com");
  console.log("  👑 管理员: boss@aiimage.com");
  for (const u of users.slice(2)) {
    console.log(`     用户: ${u.email}`);
  }
  console.log("──────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
