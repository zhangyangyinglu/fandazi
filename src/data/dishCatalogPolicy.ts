import type { Dish } from '@/types'

/**
 * 同一道菜的重复命名先保留在完整菜库，避免破坏既有收藏与计划引用；
 * 自动推荐只使用右侧的标准记录，防止同图同菜以两个名字重复出现。
 */
export const DISH_CANONICAL_ALIASES: Readonly<Record<string, string>> = {
  'mu-xi-rou-lu-ban': 'mu-xu-rou',
  'gan-bian-dou-jiao': 'gan-bian-si-ji-dou',
}

export function getRecommendationCatalog(dishes: Dish[]): Dish[] {
  return dishes.filter((dish) => !(dish.id in DISH_CANONICAL_ALIASES))
}
