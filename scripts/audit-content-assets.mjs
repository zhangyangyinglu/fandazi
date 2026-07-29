import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const productionDir = resolve(root, 'content/production')
const reportPath = resolve(productionDir, 'reports/asset-baseline.json')

function loadTypeScriptModule(relativePath) {
  const source = readFileSync(resolve(root, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', compiled)(module, module.exports)
  return module.exports
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(productionDir, relativePath), 'utf8'))
}

const { DISHES } = loadTypeScriptModule('src/data/dishes.ts')
const { INGREDIENT_IMAGE_MAP: ingredientImages } = loadTypeScriptModule('src/data/ingredientImages.ts')
const queue = readJson('image-queue.json')
const rules = readJson('ingredient-rules.json')
const dishImageDir = resolve(root, 'public/dish-images')
const ingredientImageDir = resolve(root, 'public/ingredient-images')
const dishImageFiles = new Set(readdirSync(dishImageDir))
const ingredientImageFiles = new Set(readdirSync(ingredientImageDir))
const allIngredients = new Set(DISHES.flatMap((dish) => dish.ingredients.map((ingredient) => ingredient.name)))
const normalize = (name) => rules.aliases[name] ?? name
const mappedIngredientPaths = Object.values(ingredientImages)
const mappedIngredientMissingFiles = mappedIngredientPaths.filter((path) => !existsSync(resolve(root, `public${path}`)))
const missingIngredientMappings = [...allIngredients].filter((name) => !ingredientImages[normalize(name)])
const missingDishImages = DISHES.filter((dish) => !dish.image || !dishImageFiles.has(dish.image.split('/').pop()))
const activeQueue = queue.items.filter((item) => !['attached', 'cancelled'].includes(item.status))

const report = {
  generatedAt: new Date().toISOString(),
  currentCatalog: {
    dishCount: DISHES.length,
    dishImageFileCount: dishImageFiles.size,
    dishesMissingImage: missingDishImages.map((dish) => ({ id: dish.id, name: dish.name })),
    uniqueIngredientCount: allIngredients.size,
    ingredientImageFileCount: ingredientImageFiles.size,
    ingredientMappingKeyCount: Object.keys(ingredientImages).length,
    ingredientMappingsMissingFiles: mappedIngredientMissingFiles,
    ingredientsMissingMappings: missingIngredientMappings,
  },
  productionQueue: {
    dailyAssetLimit: queue.dailyAssetLimit,
    activeItemCount: activeQueue.length,
    pendingIngredientCount: rules.pendingIngredients.length,
  },
}

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
