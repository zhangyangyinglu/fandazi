import { describe, expect, it } from 'vitest'
import { DISHES } from '@/data/dishes'
import { DISH_CANONICAL_ALIASES, getRecommendationCatalog } from '@/data/dishCatalogPolicy'

describe('菜品数据一致性', () => {
  it('每道菜使用唯一且非空的 id、名称和图片引用', () => {
    const ids = DISHES.map((dish) => dish.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const dish of DISHES) {
      expect(dish.id.trim()).not.toBe('')
      expect(dish.name.trim()).not.toBe('')
      expect(dish.image).toMatch(/^\/dish-images\/.+\.webp$/)
    }
  })

  it('共图的重复命名必须指向明确的标准菜品', () => {
    const imageOwners = new Map<string, string[]>()

    for (const dish of DISHES) {
      imageOwners.set(dish.image!, [...(imageOwners.get(dish.image!) ?? []), dish.id])
    }

    for (const [image, dishIds] of imageOwners) {
      if (dishIds.length <= 1) continue
      const canonicalIds = dishIds.filter((id) => !(id in DISH_CANONICAL_ALIASES))
      expect(canonicalIds, `${image} 必须且只能保留一个标准菜品`).toHaveLength(1)
      for (const aliasId of dishIds.filter((id) => id in DISH_CANONICAL_ALIASES)) {
        expect(DISH_CANONICAL_ALIASES[aliasId], `${aliasId} 的标准菜品映射错误`).toBe(canonicalIds[0])
      }
    }
  })

  it('自动推荐池不会同时包含共用图片的重复菜品', () => {
    const recommendationCatalog = getRecommendationCatalog(DISHES)
    const recommendationImages = recommendationCatalog.map((dish) => dish.image)

    expect(new Set(recommendationImages).size).toBe(recommendationImages.length)
    for (const canonicalId of Object.values(DISH_CANONICAL_ALIASES)) {
      expect(DISHES.some((dish) => dish.id === canonicalId), `标准菜品 ${canonicalId} 不存在`).toBe(true)
    }
  })
})
