# GPT Image Studio - 项目状态存档

> 最后更新: 2026-04-29

## 项目完成度: ~95%

## 已完成功能

### 开发环境搭建 (100%)
- [x] SQLite 开发数据库 schema (`prisma/schema.dev.prisma`)
- [x] 本地文件系统存储模式 (`src/lib/storage.ts` - DEV_MODE fallback)
- [x] Mock 生图模式 (`src/lib/openai.ts` - 无 API Key 返回 SVG 占位图)
- [x] 邮箱直登认证 (`src/lib/auth.ts` - CredentialsProvider + JWT strategy)
- [x] shadcn/ui Toast 组件 (`src/components/ui/toast.tsx`, `use-toast.ts`, `toaster.tsx`)
- [x] `components.json` 配置
- [x] dev:setup 一键初始化脚本
- [x] `.env.local` 最小化配置
- [x] `.gitignore` 正确忽略 dev.db / uploads

### 核心功能 (100%)
- [x] 首页（未登录展示介绍）
- [x] 登录页（邮箱表单 + OAuth 按钮含图标）
- [x] 仪表盘（统计卡片 + 最近生成）
- [x] 生图页面（文生图 + 图生图编辑）
  - [x] 参数面板（prompt/质量/尺寸/数量/格式/背景）
  - [x] 参考图上传（拖拽/点击）
  - [x] 预估消耗
  - [x] 异步生图 + 前端轮询完成状态（1.5s 间隔）
  - [x] 结果展示（Lightbox 放大 + 下载）
- [x] 历史记录（分页列表 + Lightbox）
  - [x] 删除（含存储文件清理）
  - [x] 复用（跳转生图页自动填充 prompt）
- [x] 额度管理（余额展示 + 变动记录 + 分页）
- [x] 管理后台（全局统计）
  - [x] 用户管理（搜索/分页/充值弹窗）

### API 接口 (100%)
- POST /api/generate - 异步生图（立即返回 generationId）
- GET /api/history - 历史列表（分页）
- GET /api/history/:id - 单条详情
- DELETE /api/history/:id - 删除（同时清理存储）
- POST /api/upload - 参考图上传
- GET /api/credits - 额度查询 + 变动记录
- GET /api/dashboard - 仪表盘统计
- GET /api/admin/stats - 管理统计
- GET /api/admin/users - 用户列表
- POST /api/admin/users - 充值额度

### UI 完善 (100%)
- [x] 侧边栏 lucide-react 图标
- [x] 登录页 OAuth 图标（GitHub SVG + Google SVG）
- [x] 暗色模式（next-themes + CSS 变量 + 主题切换按钮）
- [x] 图片 Lightbox（Radix Dialog + 下载按钮）
- [x] 移动端适配（侧边栏抽屉式）
- [x] Prompt 历史复用

### 错误处理 & 安全 (100%)
- [x] DELETE 时清理存储文件
- [x] OpenAI 错误码中文提示映射
- [x] 速率限制（Upstash Redis / 内存 fallback）
- [x] 路由保护（middleware.ts）
- [x] 额度预扣事务 + 失败自动退还
- [x] 文件类型/大小校验（上传）

## 未实现的低优先级功能（SPEC.md 中列出的）
- 批量生图（CSV/JSON 导入）
- 图片编辑增强（局部重绘 inpainting）
- API 使用统计图表（recharts）
- 国际化 (i18n)

## 启动方式
```bash
npm install
npm run dev:setup   # 初始化 SQLite + seed 管理员
npm run dev          # 启动 http://localhost:3000
```

登录邮箱: `admin@local.test`（管理员，9999 额度）
