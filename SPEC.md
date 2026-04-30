# GPT Image Studio - 项目技术规格文档

## 项目概述

多用户 AI 图片生成平台，基于 OpenAI GPT-image-1 API，支持文生图、图生图编辑、透明背景、多种质量/尺寸选项。包含用户认证、额度管理、历史记录、管理后台等完整功能。

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | Next.js (App Router) | 14.x |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS + shadcn/ui | 3.x |
| 数据库 | PostgreSQL (Supabase) | - |
| ORM | Prisma | 6.x |
| 认证 | NextAuth.js | 4.x |
| 对象存储 | Cloudflare R2 (S3 兼容) | - |
| 限速 | Upstash Redis + @upstash/ratelimit | - |
| AI API | OpenAI (gpt-image-1) | - |
| 状态管理 | zustand (前端) | 5.x |
| 部署 | Vercel + Supabase | - |

## 目录结构

```
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── seed.ts                # 种子数据（管理员初始化）
├── src/
│   ├── app/
│   │   ├── globals.css        # 全局样式（Tailwind + CSS 变量）
│   │   ├── layout.tsx         # 根布局
│   │   ├── page.tsx           # 首页（未登录展示介绍）
│   │   ├── login/
│   │   │   └── page.tsx       # 登录页
│   │   ├── (authenticated)/   # 需要登录的路由组
│   │   │   ├── layout.tsx     # 带侧边栏的布局
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx   # 仪表盘
│   │   │   ├── generate/
│   │   │   │   └── page.tsx   # 生图页面（核心）
│   │   │   ├── history/
│   │   │   │   └── page.tsx   # 历史记录
│   │   │   ├── credits/
│   │   │   │   └── page.tsx   # 额度管理
│   │   │   └── admin/
│   │   │       ├── page.tsx   # 管理后台首页
│   │   │       └── users/
│   │   │           └── page.tsx # 用户管理
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts  # NextAuth
│   │       ├── generate/route.ts            # 生图接口（核心）
│   │       ├── history/route.ts             # 历史列表
│   │       ├── history/[id]/route.ts        # 单条记录详情/删除
│   │       ├── upload/route.ts              # 参考图上传
│   │       ├── credits/route.ts             # 额度查询
│   │       ├── dashboard/route.ts           # 仪表盘统计
│   │       └── admin/
│   │           ├── stats/route.ts           # 管理统计
│   │           └── users/route.ts           # 用户管理+充值
│   ├── components/
│   │   ├── providers.tsx      # 全局 Provider
│   │   ├── layout/
│   │   │   ├── sidebar.tsx    # 侧边栏
│   │   │   └── header.tsx     # 顶栏
│   │   └── ui/
│   │       └── toaster.tsx    # Toast 占位（需 shadcn 初始化）
│   ├── lib/
│   │   ├── prisma.ts          # Prisma 客户端单例
│   │   ├── auth.ts            # NextAuth 配置
│   │   ├── openai.ts          # OpenAI 客户端 + 生图/编辑封装
│   │   ├── storage.ts         # R2 对象存储封装
│   │   ├── credits.ts         # 额度管理（预扣/退还/充值）
│   │   ├── rate-limit.ts      # 速率限制
│   │   └── utils.ts           # 通用工具函数
│   ├── middleware.ts           # 路由保护 + 权限检查
│   └── types/
│       ├── index.ts           # 全局类型定义
│       └── next-auth.d.ts     # NextAuth 类型扩展
├── .env.example               # 环境变量模板
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## 数据库模型

### 核心表

1. **User** - 用户表
   - 关联 NextAuth 的 Account/Session
   - `role`: USER | ADMIN
   - `creditsBalance`: 额度余额（整数，代表可生成张数）

2. **Generation** - 生图任务
   - 每次生图请求创建一条记录
   - `status`: PENDING → PROCESSING → COMPLETED / FAILED
   - `quality`: LOW | MEDIUM | HIGH | AUTO
   - `size`: S_1024x1024 | S_1024x1536 | S_1536x1024 | S_AUTO
   - `costCredits`: 本次消耗额度
   - `costUsd`: 本次消耗美元（用于管理统计）

3. **Image** - 生成的图片
   - 一个 Generation 可以有多张 Image（n > 1 时）
   - `storageKey`: R2 对象存储路径
   - `url`: 公开访问 URL

4. **ReferenceImage** - 参考图（编辑模式）
   - 用户上传的参考图，用于 image edit API

5. **CreditLog** - 额度变动日志
   - 记录每次额度变动（消耗、退还、充值、赠送）
   - `reason`: INITIAL_GRANT | ADMIN_GRANT | GENERATION | REFUND

---

## 核心业务流程

### 生图流程（POST /api/generate）

```
1. 认证检查 → 未登录返回 401
2. 速率限制检查 → 超限返回 429
3. 参数校验（prompt 非空、n 在 1-4、质量/尺寸合法）
4. 创建 Generation 记录（status=PENDING）
5. 预扣额度（事务：检查余额 → 扣除 → 写日志）→ 不足返回 402
6. 更新状态为 PROCESSING
7. 调用 OpenAI API（generate 或 edit）
   - 失败：退还额度 + 更新状态为 FAILED + 返回 502
8. 将返回的 base64 图片上传到 R2
9. 创建 Image 记录
10. 更新状态为 COMPLETED
11. 返回结果（图片 URL + 额度信息）
```

### 额度系统

- **预扣后退**：生图前先扣额度，失败自动退还
- **消耗规则**：low=1, medium=2, high=5 额度/张
- **事务保证**：使用 Prisma $transaction 保证原子性
- **新用户赠送**：注册时自动赠送 50 额度（可配置）
- **管理员充值**：管理员可给任意用户充值

### 认证流程

- 使用 NextAuth.js + Prisma Adapter
- 支持 GitHub OAuth 和 Google OAuth（可扩展）
- Session 中注入 user.id、user.role、user.creditsBalance
- middleware.ts 保护需要登录的路由
- /admin 路由额外检查 ADMIN 角色

---

## 待实现 / 需要完善的部分

以下是骨架中标记了 TODO 或需要进一步实现的部分：

### 高优先级

1. **shadcn/ui 组件初始化**
   - 运行 `npx shadcn-ui@latest init` 初始化
   - 安装需要的组件：`npx shadcn-ui@latest add button dialog toast select tabs avatar dropdown-menu`
   - 替换 `src/components/ui/toaster.tsx` 占位

2. **侧边栏图标**
   - `src/components/layout/sidebar.tsx` 中用 lucide-react 图标替换文字占位
   - 导入：`import { LayoutDashboard, Wand2, History, Coins, Shield, Users } from "lucide-react"`

3. **登录页 Provider 图标**
   - `src/app/login/page.tsx` 中为各 OAuth provider 添加 SVG 图标

4. **R2 文件清理**
   - `src/app/api/history/[id]/route.ts` 的 DELETE 方法中，删除记录时同步删除 R2 文件
   - 调用 `deleteFromStorage(storageKey)` 清理

5. **错误处理增强**
   - OpenAI API 的各种错误码（content_policy_violation、rate_limit 等）需要分别处理并给用户友好提示

### 中优先级

6. **图片下载功能**
   - 生成页和历史页的下载按钮需要实现真正的下载（当前是 `<a>` 标签直接链接）
   - 可能需要后端代理下载以避免跨域问题

7. **生图轮询/WebSocket**
   - 当前是同步等待 OpenAI 返回，high 质量可能超时
   - 建议改为：前端提交 → 后端返回 generationId → 前端轮询 `/api/history/{id}` 直到 status=COMPLETED
   - 或使用 Server-Sent Events (SSE)

8. **图片画廊/灯箱**
   - 历史记录和生成结果中的图片点击放大查看
   - 可用 `react-photo-view` 或类似库

9. **Prompt 模板/历史**
   - 保存常用 prompt 模板
   - 从历史记录中复用 prompt

10. **暗色模式**
    - CSS 变量已预设 dark 模式
    - 需要添加主题切换按钮和 `next-themes` 集成

### 低优先级

11. **批量生图**
    - 支持 CSV/JSON 批量导入 prompt
    - 使用队列异步处理

12. **图片编辑增强**
    - 局部重绘（inpainting）- 需要 mask 参数
    - 多参考图混合

13. **API 使用统计图表**
    - 管理后台添加 echarts/recharts 图表
    - 按日/周/月统计生成量和成本

14. **国际化 (i18n)**
    - 当前界面为中文
    - 如需多语言支持，集成 next-intl

15. **移动端适配**
    - 侧边栏改为抽屉式
    - 生图页面参数面板改为底部弹出

---

## 环境配置与部署

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量
cp .env.example .env.local
# 编辑 .env.local 填入真实值

# 3. 初始化 shadcn/ui
npx shadcn-ui@latest init

# 4. 推送数据库 schema
npx prisma db push

# 5. 生成 Prisma 客户端
npx prisma generate

# 6. （可选）初始化管理员
npm run db:seed

# 7. 启动开发服务器
npm run dev
```

### 部署到 Vercel

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录并部署
vercel

# 3. 设置环境变量（在 Vercel Dashboard 或 CLI）
vercel env add OPENAI_API_KEY
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
# ... 其他变量

# 4. 重新部署
vercel --prod
```

### 第三方服务配置

1. **Supabase（数据库）**
   - 创建项目 → Settings → Database → Connection string
   - 填入 `DATABASE_URL`

2. **Cloudflare R2（存储）**
   - 创建 Bucket → 设置公开访问域名
   - 创建 API Token（R2 读写权限）
   - 填入 R2 相关环境变量

3. **Upstash Redis（限速）**
   - 创建 Redis 数据库
   - 填入 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`

4. **OAuth Provider**
   - GitHub: Settings → Developer settings → OAuth Apps
   - Google: Google Cloud Console → APIs & Services → Credentials
   - 回调 URL: `https://your-domain.com/api/auth/callback/github`

---

## API 接口清单

| 方法 | 路径 | 说明 | 认证 | 权限 |
|------|------|------|------|------|
| POST | /api/generate | 生成图片 | 需要 | USER+ |
| GET | /api/history | 历史记录列表 | 需要 | USER+ |
| GET | /api/history/:id | 单条记录详情 | 需要 | USER+（仅自己） |
| DELETE | /api/history/:id | 删除记录 | 需要 | USER+（仅自己） |
| POST | /api/upload | 上传参考图 | 需要 | USER+ |
| GET | /api/credits | 额度信息+变动记录 | 需要 | USER+ |
| GET | /api/dashboard | 仪表盘统计 | 需要 | USER+ |
| GET | /api/admin/stats | 管理统计 | 需要 | ADMIN |
| GET | /api/admin/users | 用户列表 | 需要 | ADMIN |
| POST | /api/admin/users | 充值额度 | 需要 | ADMIN |

---

## 额度消耗对照表

| 质量 | 额度/张 | OpenAI 单价 (1024×1024) | 说明 |
|------|---------|------------------------|------|
| low | 1 | ~$0.011 | 草稿、测试 |
| medium | 2 | ~$0.042 | 推荐，性价比最高 |
| high | 5 | ~$0.167 | 商业素材 |
| auto | 2 | ~$0.042 | 模型自选 |

> 注意：1536 尺寸的价格约为 1024 的 1.5 倍

---

## 安全要点

1. **OpenAI API Key 仅在服务端使用**，绝不暴露给前端
2. **额度操作使用数据库事务**，防止并发扣款问题
3. **文件上传校验**：类型白名单 + 大小限制（10MB）
4. **速率限制**：每用户每分钟 10 次生图请求
5. **路由保护**：middleware.ts 统一拦截未认证请求
6. **管理权限**：/admin 路由额外检查 ADMIN 角色
7. **输入校验**：prompt 长度限制、n 范围限制
