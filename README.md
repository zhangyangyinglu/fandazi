# 🍚 饭搭子 — 让家人一起好好吃饭

> 家庭做饭助手：从"今天吃什么"到"冰箱里有什么"到"买什么"到"做出来好不好吃"，一条龙。
> 209 道家常菜谱 + 冰箱管理 + 智能计划 + 购物清单 + 饭团游戏化 + 家庭空间 + 家庭同步。饭团 AI 支持用户自配 OpenAI-compatible Key，健康事实可由对话提取并写入本地档案。

🔗 **在线体验**：[fandazi-web-tool.vercel.app](https://fandazi-web-tool.vercel.app)

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| 🍳 菜品推荐 | 209 道家常菜谱，按冰箱食材、健康标签、家庭偏好智能排序 |
| 🧊 冰箱管理 | 记录食材、保质期提醒、自动匹配"冰箱可做"菜品 |
| 📅 计划日历 | 按天排菜，标记做过后自动沉淀到"我家版" |
| 🛒 购物清单 | 按菜品自动生成购物清单，支持勾选采购、按菜分组 |
| 🏠 我家版本 | 每次做完记录口味反馈，沉淀成你家独有的菜谱变体 |
| 🍙 饭团游戏化 | 签到赚米粒、副本挑战、抽卡图鉴——让做饭变成小游戏 |
| 🤖 AI 厨房 | 支持用户自配 DeepSeek / OpenAI / OpenAI-compatible 服务；无 Key 时使用本地 fallback |
| 💚 健康接口 | 支持查看、删除本地健康事实；饭团 AI 可从用户明确表达中提取事实，需用户自行配置外部服务 |
| 👨‍👩‍👧 家庭空间 | 自定义家庭成员、掌勺人轮换、健康问卷、搭子偏好 |
| ☁️ 家庭同步 | Supabase 后端，一个家庭一个共享云端，多人多设备同步 |

## 🚀 快速开始

### 环境要求

- Node.js 20+
- npm 10+

### 安装 & 本地运行

```bash
git clone https://github.com/zhangyangyinglu/fandazi.git
cd fandazi
npm install
npm run dev
```

保存或上传菜品后自动更新线上版本：

```bash
npm run auto-publish
```

该进程监听工程改动，自动执行构建检查、提交并推送 GitHub，随后由 Vercel 自动部署。构建或推送失败时会保留本地改动，修复后继续尝试。

macOS 上可安装为登录后自动运行的后台服务：

```bash
npm run auto-publish:install
```

后台服务会在电脑登录后启动，断网或构建失败时每 60 秒重试；`.env`、密钥和凭据类文件会阻止自动发布。

浏览器打开 `http://localhost:5173` 即可。

### 构建

```bash
npm run build      # tsc 类型检查 + vite 生产构建
npm run preview    # 本地预览生产构建
```

### 测试 & 代码检查

```bash
npm test           # vitest 单元测试
npx eslint src/    # eslint 代码规范检查
npx tsc -b --noEmit  # TypeScript 类型检查
```

## 📦 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 6 | 类型安全 |
| Vite | 8 | 构建工具 |
| React Router | 7 | 路由 |
| Zustand | 5 | 状态管理 |
| Supabase | 2 | 后端同步（可选） |
| vite-plugin-pwa | 1.3 | PWA 离线支持 |
| Vitest | 4 | 单元测试 |

## ☁️ 家庭同步配置（可选）

饭搭子默认纯本地运行（数据存在浏览器 localStorage）。如需多设备同步：

1. 在 [Supabase](https://supabase.com) 创建一个项目
2. 打开 App 的「同步」页面，填入 Supabase URL 和 anon key
3. 注册账号 → 创建家庭组 → 获得邀请包（URL + key + 邀请码）
4. 家庭成员在各设备填入同一组凭据即可同步

> 一个家庭 = 一个共享 Supabase 后端。一个人也可以用一个家庭组。

## 🤖 AI 厨房与健康接口

- 在同步页或饭团 AI 设置中，用户可以配置 DeepSeek、OpenAI 或其他 OpenAI-compatible 服务。
- Key 只保存在用户本机 localStorage；已配置 Supabase 家庭组时，可按家庭共享配置。Key 不进入仓库、公开 Demo 或项目日志。
- 用户配置并发起 AI 对话后，当前对话上下文可能发送到用户选择的外部 AI 服务；未配置 Key 时不假装调用，使用本地 fallback。
- 饭团 AI 只从用户明确表达中提取健康事实，写入本地健康档案；用户可以查看和删除。
- 健康相关标签、营养估算和 AI 建议仅供家庭参考，不构成医疗或营养诊断。

## 🖼️ 图片与素材来源

- 菜品图与食材图用于本项目展示与本地使用；发布前需确认素材来源/授权，不使用用户私人源图路径入仓。
- 工程内展示图统一放在 `public/dish-images/` 与 `public/ingredient-images/`，发布仓库不应包含本机 `~/Pictures/`、临时工作台或未压缩源文件。
- 图标与品牌素材位于 `public/icons/`、`public/favicon.png`、`public/apple-touch-icon.png`、`public/brand-logo.png`。

## 🔐 隐私与数据边界

- 默认数据存储在浏览器 localStorage。
- 开启家庭同步时，用户自行配置 Supabase 项目；一个人也可以使用一个家庭组。
- Supabase anon key 是前端公开 key；不要提交 service_role key、PAT 或任何私人 token。
- 隐私政策见应用内 `/privacy` 页面与仓库 `PRIVACY.md`。

## 📐 项目结构

```
src/
├── app/           # 应用入口 & 路由
├── components/    # 通用组件（TopNav, FloatingFantuan, healthProfileStorage...）
├── data/          # 数据层（dishes, nutrition, recommend, gamification, aiRecipe...）
├── design/        # 设计令牌（tokens.css）
├── lib/           # 基础设施（supabaseClient, familyCloudSync, familyAuth...）
├── pages/         # 页面组件（12 个路由页面）
├── stores/        # Zustand store
└── types.ts       # 全局类型定义
```

## 📄 License

[MIT](./LICENSE)

## 🤝 贡献

欢迎提 Issue 和 PR。目前仍在积极开发中。

## ⚠️ 免责声明

- 营养数据来源于《中国食物成分表》第 6 版 / USDA FoodData Central，仅供家庭参考，不作为医疗级数据
- 健康推荐基于《中国居民膳食指南》2026 版，**不替代专业医疗或营养建议**
- 有特定健康问题（糖尿病、肾病、过敏等）请遵医嘱

## 🗓️ 项目状态

- **版本**：0.1.0
- **状态**：GitHub 已发布；线上生产部署需单独确认
- **最新更新**：2026-07-12
