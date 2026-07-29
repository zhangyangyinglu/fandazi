# 饭搭子内容生产台账

这里管理从候选菜谱到正式发布之间的生产状态，不替代 `src/data/dishes.ts`、`src/data/ingredientImages.ts` 或图片资源目录。

## 三份台账

- `recipe-candidates.json`：候选菜及其结构化菜谱、来源、去重与发布状态。
- `ingredient-rules.json`：食材标准名与别名；既有图片映射仍以 `src/data/ingredientImages.ts` 为准。
- `image-queue.json`：菜图、食材图共用的图片生产队列。每日最多处理 5 个 `queued` 项。

## 发布规则

一条菜谱只有在以下条件同时成立时才可从候选状态进入正式菜品库：

1. 菜谱字段完整，且与现有菜去重通过；
2. 自身菜图状态为 `attached`；
3. 所有食材已规范化，且均能映射到存在的食材图片；
4. 图片与源码审计、测试、构建全部通过。

## 图片提示词

每一项图片任务必须保存完整的 `prompt`、`visualSpecVersion`、输出文件名与状态。提示词在入队时生成并冻结；后续重试复用同一版本，不能按日期临时改写。

当前视觉规范尚未锁定。选定通过验收的样图后，建立 `dish-photo-v1` 与 `ingredient-photo-v1`。

## 日常节奏

每天只从 `image-queue.json` 取最多 5 项。缺失食材图优先于依赖它的菜图；同一条菜必须在菜图和全部食材图齐全后才可发布。

运行 `node scripts/audit-content-assets.mjs` 会更新 `reports/asset-baseline.json`，检查菜图、食材图、映射与待发布依赖。
