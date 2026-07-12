/**
 * 数据导出 — 将本地 localStorage 数据导出为 JSON 文件
 * 用于合规（用户有权获取自己的数据）和备份
 */
import { useFandaziStore } from '@/stores/fandaziStore'

export interface ExportData {
  exportedAt: string
  version: string
  pantry: unknown[]
  mealPlans: unknown[]
  shoppingList: unknown[]
  cookingLogs: unknown[]
  myDishVersions: unknown[]
  healthProfiles: unknown
  fantuan: {
    mili: number
    level: number
    cookingStreak: number
    totalCooked: number
  }
}

export function exportAllData(): void {
  const state = useFandaziStore.getState()

  const data: ExportData = {
    exportedAt: new Date().toISOString(),
    version: '0.1.0',
    pantry: state.pantry,
    mealPlans: state.mealPlans,
    shoppingList: state.shoppingList,
    cookingLogs: state.cookingLogs,
    myDishVersions: state.myDishVersions,
    healthProfiles: readHealthProfiles(),
    fantuan: state.fantuan,
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fandazi-data-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function readHealthProfiles(): unknown {
  try {
    const raw = localStorage.getItem('fandazi.healthProfiles')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
