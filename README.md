# 饭搭子 Fandazi Web Tool

饭搭子是一个 **GitHub 开源型 Web 工具版家庭做饭助手**：打开网页就能从菜品、冰箱、计划、购物清单、我家版做饭记录、饭团游戏化和 AI 厨房开始使用。

> 当前线上 Demo：<https://fandazi-web-tool.vercel.app>

## 这个项目解决什么

很多家庭做饭的问题不是“不会做菜”，而是：

- 今天不知道吃什么；
- 冰箱里有什么记不清；
- 计划和购物清单分离；
- 做过的口味调整下次又忘；
- AI 生成菜谱很强，但缺少家庭上下文；
- 健康建议、家庭偏好、做饭记录没有沉淀。

饭搭子把这些串成一个可演示、可自用、可继续扩展的 Web 工具。

## 主要功能

### 菜品工作区

- 打开即进入菜品库，不做传统 App 首页；
- 支持搜索、场景筛选、健康标签、冰箱匹配；
- 菜品卡可加入计划、加入购物清单、查看详情；
- 支持桌面与移动端布局。

### 菜品详情

- 菜品说明、预计用时、份量、健康负担；
- 食材清单显示冰箱已有 / 缺少；
- 做法步骤；
- 健康摘要；
- 饭团建议；
- 加入今晚计划 / 加入购物清单 / 标记做过 / 改成我家版。

### 冰箱

- Demo 冰箱库存；
- 食材分类、数量、保质期、状态；
- 查看可做、记录用掉、补采购；
- 与计划和购物清单联动。

### 计划 + 购物清单

- 晚餐计划；
- 根据计划和冰箱库存计算缺失食材；
- 购物清单按菜品来源分组；
- checkbox 勾选采购；
- 做完后回流到做饭记录和我家版。

### 我家版 + 做饭记录

- 记录家里真实做过的菜；
- 沉淀“我家口味”与“阿川偏好”；
- 做饭记录 timeline；
- 米粒奖励；
- 下次做同一道菜时带上历史调整。

### 饭团游戏化

- 饭团状态、等级、米粒；
- 签到、副本、抽饭团、图鉴；
- 将做饭行为变成轻量陪伴和反馈。

### AI 厨房

- 用户自配 API Key；
- 根据菜名生成菜谱；
- 根据冰箱食材推荐菜；
- 可取消请求；
- 调试输出折叠；
- 无 Key 时可作为普通菜品/计划/冰箱工具使用。

## Demo 与私人数据分离

本项目默认展示公开 Demo 数据，方便 GitHub 访问者直接理解产品：

- Demo 菜品、冰箱、计划、购物、我家版记录均为演示数据；
- 用户真实使用数据默认保存在浏览器 `localStorage`；
- AI API Key 只保存在用户本机浏览器 `localStorage`，不会上传到本项目服务器；
- 若后续接入 Supabase / 数据库，应将公开 Demo 与私人家庭空间隔离。

当前 localStorage key：

```text
fandazi-web-tool
fandazi.aiKitchen.apiConfig
```

## 技术栈

- Vite 8
- React 19
- TypeScript 6
- React Router 7
- Zustand 5 + persist
- vite-plugin-pwa
- Vercel 静态部署

## 本地运行

需要 Node.js 22+。

```bash
npm install
npm run dev
```

默认本地开发地址：

```text
http://localhost:5173
```

## 构建

```bash
npm run build
```

本项目构建会执行：

```bash
tsc -b && vite build
```

## 预览构建结果

```bash
npm run preview
```

## 部署到 Vercel

### 使用 Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

本项目包含 `vercel.json`，用于修复 React Router 子路由刷新 404：

```json
{
  "rewrites": [
    {
      "source": "/((?!manifest.webmanifest|sw.js|workbox-.*\\.js|registerSW.js|assets/.*|icons/.*).*)",
      "destination": "/index.html"
    }
  ]
}
```

### 部署后建议验证

```bash
for path in / /mine /pantry /plan /shopping /recipes/broccoli-chicken-egg /ai-kitchen /fantuan /manifest.webmanifest /sw.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://YOUR_DOMAIN$path")
  echo "$path $code"
done
```

所有路径应返回 `200`。

## AI Key 配置

进入 `AI厨房` 页面后，可选择服务商并填写 API Key。

注意：

- Key 只保存在浏览器 localStorage；
- 本项目不提供后端代理；
- 如果直接在浏览器调用第三方 OpenAI-compatible API，需确认该服务允许浏览器跨域请求；
- 公开 Demo 不应内置任何真实 API Key。

## 健康与法律边界

饭搭子的健康信息只用于家庭饮食参考：

- 不是医疗建议；
- 不替代医生、营养师或专业诊断；
- 对过敏、疾病、药物禁忌、孕产、儿童、老人等特殊情况，用户需要自行咨询专业人士；
- AI 生成内容需要人工确认后再使用。

## 数据与素材边界

- Demo 菜品与说明用于产品演示；
- 若加入真实菜品图片，请确认图片来源、版权与授权；
- 不要把私人家庭数据、真实 API Key、未授权图片提交到公开仓库；
- 若公开发布，建议使用演示数据与可授权素材。

## 推荐开发流程

```bash
npm install
npm run dev
npm run build
```

提交或部署前至少检查：

```bash
npm run build
```

如已部署到 Vercel，检查关键路由：

```bash
for path in / /mine /pantry /plan /shopping /recipes/broccoli-chicken-egg /manifest.webmanifest /sw.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://fandazi-web-tool.vercel.app$path")
  echo "$path $code"
done
```

## 当前状态

- P0：方向收口 + 完整功能排期 + 旧代码审计 ✅
- P1：UI 设计系统 + v6 渲染图 + 前端骨架 ✅
- P2：菜品主链路 + 冰箱 + 计划 + 购物 + 我家版 ✅
- P3：家庭共用能力已在功能层演示；多人 Supabase 属后续增强 ✅ / ⏳
- P4：饭团游戏化 + 抽卡 + 图鉴 ✅
- P5：AI 厨房 ✅
- P6：健康分析增强版 ⏳
- P7：GitHub 开源包装 / README / 部署说明 🔄

## License

MIT
