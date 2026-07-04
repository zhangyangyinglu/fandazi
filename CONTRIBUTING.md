# 贡献指南

感谢你对饭搭子项目的兴趣！

## 开发环境

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/fandazi-web-tool.git
cd fandazi-web-tool

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
# 打开 http://localhost:5173

# 4. 构建
npm run build

# 5. 测试
npm test

# 6. Lint
npm run lint
```

## 技术栈

- Vite 8 + React 19 + TypeScript 6
- React Router 7
- Zustand 5（状态管理 + localStorage 持久化）
- PWA（vite-plugin-pwa）
- Vitest（测试）

## 代码规范

- TypeScript strict mode
- ESLint + React Hooks 规则
- 提交前确保 `npm run lint` 和 `npm test` 通过

## 提交格式

```
<类型>: <描述>

类型: feat | fix | docs | style | refactor | test | chore
```

## 项目结构

```
src/
├── app/           # App 入口 + 路由
├── components/     # 共享组件（TopNav, FloatingFantuan）
├── data/           # 业务逻辑（dishes, recommend, healthRecommend, gamification）
├── design/         # 设计 tokens
├── pages/          # 页面组件
├── stores/         # Zustand store
└── types.ts        # TypeScript 类型定义
```

## 营养口径

本项目的营养建议基于《中国居民膳食指南》2026 版。

## License

MIT
