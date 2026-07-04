// ============================================================================
// ingredientImages — 食材图片映射 (v1.11 M3/M4 图片批量接入)
// ----------------------------------------------------------------------------
// 初始为空映射。M4 批量生图完成后，integrate-images.py 脚本会自动
// 将 ingredient-{pinyin}.png 路径写入此文件。
//
// 查找优先级：
//   1. 精确食材名匹配（如 "西红柿" → /ingredient-images/ingredient-xihongshi.png）
//   2. 无匹配 → 返回 null（调用方 fallback 到分类 emoji）
// ============================================================================

const INGREDIENT_IMAGE_MAP: Record<string, string> = {
  // M4 生图完成后，脚本自动在此填充映射
  // 格式: '食材名': '/ingredient-images/ingredient-{pinyin}.png',
}

/**
 * 按食材名查找图片路径，无图返回 null
 */
export function getIngredientImage(name: string): string | null {
  return INGREDIENT_IMAGE_MAP[name] ?? null
}
