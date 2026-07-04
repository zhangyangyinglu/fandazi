/**
 * 营养数据库
 *
 * 每个 profile 是"每 100g"的营养参考值，用于本地估算菜品营养。
 *
 * 字段含义：
 * - kcal       热量（kcal/100g）
 * - protein    蛋白质（g/100g）
 * - carbs      碳水化合物（g/100g）
 * - fat        脂肪（g/100g）
 * - fiber      膳食纤维（g/100g）
 * - sodium     钠（mg/100g） —— 高钠会拉低健康评分
 * - sugar      糖（g/100g）   —— 自然糖 + 添加糖合计
 * - satFat     饱和脂肪（g/100g）
 * - defaultGrams 一道菜里"该类食材"的默认克数（用于 fallback 估算）
 *
 * 数据来源：中国食物成分表第 6 版 / USDA FoodData Central（调味品部分用前者）
 * 仅为家庭参考，不是医疗级数据。
 */

export type NutritionProfile = {
  keywords: string[]
  defaultGrams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  sugar: number
  satFat: number
}

export const NUTRITION_PROFILES: NutritionProfile[] = [
  // —— 禽肉蛋 ——
  { keywords: ['鸡胸肉', '鸡肉', '鸡丁', '鸡丝', '去皮鸡胸'], defaultGrams: 120, kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 70, sugar: 0, satFat: 1 },
  { keywords: ['鸡腿肉', '去皮鸡腿肉', '鸡腿'], defaultGrams: 150, kcal: 240, protein: 19, carbs: 0, fat: 18, fiber: 0, sodium: 80, sugar: 0, satFat: 6 },
  { keywords: ['鸡胗', '鸡心'], defaultGrams: 100, kcal: 118, protein: 19, carbs: 0.5, fat: 4, fiber: 0, sodium: 100, sugar: 0, satFat: 1.5 },
  { keywords: ['鸭肉', '鸭腿'], defaultGrams: 150, kcal: 240, protein: 19, carbs: 0, fat: 18, fiber: 0, sodium: 80, sugar: 0, satFat: 6 },
  { keywords: ['鸽子'], defaultGrams: 250, kcal: 195, protein: 22, carbs: 0, fat: 11, fiber: 0, sodium: 90, sugar: 0, satFat: 3.5 },
  { keywords: ['鸡蛋', '蛋液', '蛋清', '蛋黄', '蛋'], defaultGrams: 55, kcal: 144, protein: 13, carbs: 1.1, fat: 9.5, fiber: 0, sodium: 130, sugar: 1.1, satFat: 3.1 },

  // —— 海鲜 ——
  { keywords: ['虾仁', '虾'], defaultGrams: 100, kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, fiber: 0, sodium: 200, sugar: 0, satFat: 0.1 },
  { keywords: ['三文鱼'], defaultGrams: 120, kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sodium: 60, sugar: 0, satFat: 3 },
  { keywords: ['海参', '即食海参'], defaultGrams: 120, kcal: 65, protein: 14, carbs: 0.5, fat: 0.3, fiber: 0, sodium: 200, sugar: 0, satFat: 0.1 },
  { keywords: ['海蛎', '牡蛎', '生蚝'], defaultGrams: 120, kcal: 73, protein: 7, carbs: 5, fat: 2, fiber: 0, sodium: 400, sugar: 0, satFat: 0.5 },
  { keywords: ['黑鱼'], defaultGrams: 180, kcal: 100, protein: 19, carbs: 0, fat: 2.5, fiber: 0, sodium: 65, sugar: 0, satFat: 0.6 },
  { keywords: ['鲈鱼', '鱼片', '鱼肉', '鳕鱼'], defaultGrams: 180, kcal: 105, protein: 20, carbs: 0, fat: 2, fiber: 0, sodium: 144, sugar: 0, satFat: 0.5 },
  { keywords: ['花鲢鱼头', '胖头鱼头', '鳙鱼头'], defaultGrams: 600, kcal: 100, protein: 18, carbs: 0, fat: 3, fiber: 0, sodium: 60, sugar: 0, satFat: 0.7 },
  { keywords: ['带鱼'], defaultGrams: 150, kcal: 130, protein: 18, carbs: 0, fat: 6, fiber: 0, sodium: 120, sugar: 0, satFat: 1.5 },

  // —— 畜肉 ——
  { keywords: ['牛肉', '瘦牛肉', '牛腱', '牛腩', '牛舌', '牛肚'], defaultGrams: 120, kcal: 180, protein: 22, carbs: 0, fat: 9, fiber: 0, sodium: 60, sugar: 0, satFat: 3.5 },
  { keywords: ['猪肉', '瘦肉', '里脊'], defaultGrams: 120, kcal: 143, protein: 20, carbs: 0, fat: 6, fiber: 0, sodium: 55, sugar: 0, satFat: 2 },
  { keywords: ['排骨'], defaultGrams: 150, kcal: 264, protein: 17, carbs: 0, fat: 21, fiber: 0, sodium: 60, sugar: 0, satFat: 7 },
  { keywords: ['羊肉'], defaultGrams: 120, kcal: 203, protein: 19, carbs: 0, fat: 14, fiber: 0, sodium: 70, sugar: 0, satFat: 7 },
  { keywords: ['五花肉', '肥瘦猪肉'], defaultGrams: 120, kcal: 395, protein: 9, carbs: 0, fat: 40, fiber: 0, sodium: 60, sugar: 0, satFat: 14 },
  { keywords: ['肋排', '猪肋排', '排骨段'], defaultGrams: 150, kcal: 264, protein: 17, carbs: 0, fat: 21, fiber: 0, sodium: 60, sugar: 0, satFat: 7 },
  { keywords: ['里脊', '猪里脊', '里脊肉'], defaultGrams: 120, kcal: 143, protein: 20, carbs: 0, fat: 6, fiber: 0, sodium: 55, sugar: 0, satFat: 2 },
  { keywords: ['鸡翅', '鸡翅中', '鸡翅根', '鸡全翅'], defaultGrams: 150, kcal: 194, protein: 18, carbs: 0, fat: 13, fiber: 0, sodium: 80, sugar: 0, satFat: 3.5 },
  { keywords: ['鸡爪', '鸡脚'], defaultGrams: 150, kcal: 215, protein: 19, carbs: 0, fat: 15, fiber: 0, sodium: 70, sugar: 0, satFat: 4 },
  { keywords: ['鸭翅', '鸭胗'], defaultGrams: 150, kcal: 220, protein: 18, carbs: 0, fat: 16, fiber: 0, sodium: 75, sugar: 0, satFat: 4 },

  // —— 海鲜 ——
  { keywords: ['大虾', '基围虾', '白虾', '草虾'], defaultGrams: 150, kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, fiber: 0, sodium: 200, sugar: 0, satFat: 0.1 },
  { keywords: ['蛤蜊', '花蛤', '文蛤'], defaultGrams: 150, kcal: 62, protein: 10, carbs: 2, fat: 1, fiber: 0, sodium: 370, sugar: 0, satFat: 0.2 },
  { keywords: ['扇贝', '鲜扇贝'], defaultGrams: 100, kcal: 77, protein: 14, carbs: 2, fat: 1, fiber: 0, sodium: 280, sugar: 0, satFat: 0.2 },

  // —— 豆制品 ——
  { keywords: ['豆腐', '嫩豆腐', '老豆腐', '北豆腐', '南豆腐'], defaultGrams: 150, kcal: 80, protein: 8, carbs: 2, fat: 4.8, fiber: 0.4, sodium: 7, sugar: 0.5, satFat: 0.7 },
  { keywords: ['豆腐皮', '千张', '豆皮'], defaultGrams: 80, kcal: 410, protein: 51, carbs: 21, fat: 23, fiber: 2, sodium: 3, sugar: 1, satFat: 3 },
  { keywords: ['豆干', '香干'], defaultGrams: 100, kcal: 195, protein: 17, carbs: 5, fat: 13, fiber: 1, sodium: 230, sugar: 0.5, satFat: 2 },
  { keywords: ['豆浆'], defaultGrams: 200, kcal: 33, protein: 3.3, carbs: 1.8, fat: 1.6, fiber: 0, sodium: 12, sugar: 0, satFat: 0.2 },
  { keywords: ['腐竹'], defaultGrams: 30, kcal: 460, protein: 44, carbs: 23, fat: 22, fiber: 2, sodium: 4, sugar: 0, satFat: 3 },

  // —— 常见绿叶菜 + 根茎瓜果 ——
  { keywords: ['西兰花'], defaultGrams: 200, kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, sodium: 33, sugar: 1.7, satFat: 0 },
  { keywords: ['花菜', '菜花', '白花菜'], defaultGrams: 200, kcal: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2, sodium: 30, sugar: 1.9, satFat: 0 },
  { keywords: ['上海青'], defaultGrams: 200, kcal: 14, protein: 1.5, carbs: 2.2, fat: 0.2, fiber: 1.2, sodium: 56, sugar: 1.1, satFat: 0 },
  { keywords: ['菠菜'], defaultGrams: 200, kcal: 24, protein: 2.6, carbs: 3.6, fat: 0.3, fiber: 2.8, sodium: 79, sugar: 0.4, satFat: 0 },
  { keywords: ['小青菜', '青菜'], defaultGrams: 200, kcal: 18, protein: 1.6, carbs: 2.8, fat: 0.2, fiber: 1.2, sodium: 60, sugar: 1, satFat: 0 },
  { keywords: ['生菜', '生菜叶'], defaultGrams: 200, kcal: 15, protein: 1.3, carbs: 2.9, fat: 0.3, fiber: 1, sodium: 28, sugar: 0.8, satFat: 0 },
  { keywords: ['冬瓜'], defaultGrams: 250, kcal: 12, protein: 0.4, carbs: 2.6, fat: 0.2, fiber: 0.7, sodium: 1, sugar: 1.2, satFat: 0 },
  { keywords: ['黄瓜'], defaultGrams: 150, kcal: 16, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, sodium: 5, sugar: 1.7, satFat: 0 },
  { keywords: ['芦笋'], defaultGrams: 200, kcal: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiber: 2.1, sodium: 2, sugar: 1.9, satFat: 0 },
  { keywords: ['番茄', '西红柿'], defaultGrams: 200, kcal: 19, protein: 0.9, carbs: 4, fat: 0.2, fiber: 1.2, sodium: 5, sugar: 2.6, satFat: 0 },
  { keywords: ['彩椒', '青椒', '红椒'], defaultGrams: 100, kcal: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, sodium: 4, sugar: 4.2, satFat: 0 },
  { keywords: ['芹菜'], defaultGrams: 150, kcal: 16, protein: 0.7, carbs: 3, fat: 0.2, fiber: 1.6, sodium: 80, sugar: 1.3, satFat: 0 },
  { keywords: ['白菜', '大白菜'], defaultGrams: 200, kcal: 13, protein: 1.2, carbs: 2.2, fat: 0.1, fiber: 0.9, sodium: 57, sugar: 1.2, satFat: 0 },
  { keywords: ['香菜'], defaultGrams: 20, kcal: 33, protein: 2.1, carbs: 6.3, fat: 0.5, fiber: 2.8, sodium: 48, sugar: 2.8, satFat: 0 },
  { keywords: ['豆芽', '绿豆芽', '黄豆芽'], defaultGrams: 100, kcal: 44, protein: 4.4, carbs: 8, fat: 0.2, fiber: 1.5, sodium: 5, sugar: 4, satFat: 0 },
  { keywords: ['胡萝卜'], defaultGrams: 100, kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sodium: 69, sugar: 4.7, satFat: 0 },
  { keywords: ['丝瓜'], defaultGrams: 200, kcal: 20, protein: 1, carbs: 4, fat: 0.2, fiber: 0.6, sodium: 2, sugar: 2, satFat: 0 },
  { keywords: ['空心菜'], defaultGrams: 200, kcal: 25, protein: 2.2, carbs: 4, fat: 0.3, fiber: 2.2, sodium: 95, sugar: 0.8, satFat: 0 },
  { keywords: ['莴笋'], defaultGrams: 150, kcal: 14, protein: 1, carbs: 2.8, fat: 0.1, fiber: 0.6, sodium: 36, sugar: 0.9, satFat: 0 },
  { keywords: ['蚕豆', '胡豆'], defaultGrams: 100, kcal: 104, protein: 8.8, carbs: 19, fat: 0.4, fiber: 4.5, sodium: 4, sugar: 5.7, satFat: 0.1 },
  { keywords: ['油菜', '上海青', '油菜心'], defaultGrams: 200, kcal: 14, protein: 1.5, carbs: 2.2, fat: 0.2, fiber: 1.2, sodium: 56, sugar: 1.1, satFat: 0 },
  { keywords: ['小白菜'], defaultGrams: 200, kcal: 17, protein: 1.5, carbs: 2.7, fat: 0.3, fiber: 1.1, sodium: 73, sugar: 1.1, satFat: 0 },
  { keywords: ['娃娃菜'], defaultGrams: 200, kcal: 14, protein: 1.5, carbs: 2.4, fat: 0.2, fiber: 1, sodium: 50, sugar: 1, satFat: 0 },
  { keywords: ['南瓜'], defaultGrams: 150, kcal: 26, protein: 1, carbs: 6.5, fat: 0.1, fiber: 1, sodium: 1, sugar: 2.4, satFat: 0 },
  { keywords: ['茄子', '紫茄子'], defaultGrams: 150, kcal: 23, protein: 1, carbs: 5, fat: 0.2, fiber: 2.3, sodium: 2, sugar: 2.6, satFat: 0 },
  { keywords: ['土豆', '马铃薯'], defaultGrams: 150, kcal: 77, protein: 2, carbs: 17, fat: 0.2, fiber: 2.2, sodium: 6, sugar: 0.8, satFat: 0 },
  { keywords: ['芋头', '芋艿'], defaultGrams: 150, kcal: 79, protein: 2.2, carbs: 18, fat: 0.2, fiber: 4.1, sodium: 33, sugar: 0.4, satFat: 0 },
  { keywords: ['辣萝卜', '萝卜干', '腌萝卜'], defaultGrams: 30, kcal: 30, protein: 1.5, carbs: 5, fat: 0.3, fiber: 1.5, sodium: 2400, sugar: 0, satFat: 0 },
  { keywords: ['梅花肉', '梅头肉'], defaultGrams: 120, kcal: 200, protein: 19, carbs: 0, fat: 13, fiber: 0, sodium: 60, sugar: 0, satFat: 5 },
  { keywords: ['白萝卜'], defaultGrams: 150, kcal: 16, protein: 0.7, carbs: 3.4, fat: 0.1, fiber: 1, sodium: 49, sugar: 1.7, satFat: 0 },
  { keywords: ['圣女果', '小番茄', '樱桃番茄'], defaultGrams: 75, kcal: 20, protein: 0.9, carbs: 4, fat: 0.2, fiber: 0.8, sodium: 5, sugar: 2.5, satFat: 0 },
  { keywords: ['包菜', '圆白菜', '卷心菜', '大头菜'], defaultGrams: 200, kcal: 22, protein: 1.3, carbs: 4.6, fat: 0.2, fiber: 0.9, sodium: 27, sugar: 2.3, satFat: 0 },
  { keywords: ['洋葱'], defaultGrams: 100, kcal: 39, protein: 1.1, carbs: 9, fat: 0.2, fiber: 1.7, sodium: 4, sugar: 4.2, satFat: 0 },
  { keywords: ['韭菜'], defaultGrams: 100, kcal: 24, protein: 2.4, carbs: 4.6, fat: 0.4, fiber: 1.4, sodium: 8, sugar: 2.4, satFat: 0 },
  { keywords: ['蒜苗', '蒜薹'], defaultGrams: 100, kcal: 37, protein: 2.7, carbs: 8, fat: 0.4, fiber: 1.8, sodium: 5, sugar: 4.1, satFat: 0 },
  { keywords: ['豆角', '四季豆', '长豆角'], defaultGrams: 150, kcal: 28, protein: 1.8, carbs: 6, fat: 0.2, fiber: 2.3, sodium: 3, sugar: 1.7, satFat: 0 },
  { keywords: ['莲藕', '藕'], defaultGrams: 150, kcal: 70, protein: 2, carbs: 16, fat: 0.2, fiber: 2.6, sodium: 40, sugar: 3, satFat: 0 },
  { keywords: ['酸菜'], defaultGrams: 100, kcal: 22, protein: 1.1, carbs: 3, fat: 0.2, fiber: 1, sodium: 1100, sugar: 0.5, satFat: 0 },
  { keywords: ['外婆菜', '外婆菜（腌菜）', '湘西外婆菜'], defaultGrams: 100, kcal: 25, protein: 1.5, carbs: 4, fat: 0.3, fiber: 1.5, sodium: 1300, sugar: 0.5, satFat: 0 },
  { keywords: ['凉皮'], defaultGrams: 200, kcal: 130, protein: 4, carbs: 28, fat: 0.5, fiber: 0.8, sodium: 350, sugar: 0.5, satFat: 0 },

  // —— 菌菇海藻 ——
  { keywords: ['香菇'], defaultGrams: 80, kcal: 26, protein: 3, carbs: 5, fat: 0.3, fiber: 3.4, sodium: 4, sugar: 0, satFat: 0 },
  { keywords: ['冬菇', '干冬菇'], defaultGrams: 30, kcal: 277, protein: 20, carbs: 56, fat: 1.5, fiber: 32, sodium: 25, sugar: 2, satFat: 0 },
  { keywords: ['云吞皮', '馄饨皮'], defaultGrams: 80, kcal: 280, protein: 9, carbs: 56, fat: 1, fiber: 1.5, sodium: 300, sugar: 0.5, satFat: 0.2 },
  { keywords: ['饺子皮'], defaultGrams: 80, kcal: 280, protein: 9, carbs: 56, fat: 1, fiber: 1.5, sodium: 300, sugar: 0.5, satFat: 0.2 },
  { keywords: ['芝麻油', '麻油', '香油'], defaultGrams: 5, kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 2, sugar: 0, satFat: 14 },
  { keywords: ['口蘑', '白蘑菇'], defaultGrams: 100, kcal: 22, protein: 3, carbs: 5, fat: 0.3, fiber: 1, sodium: 5, sugar: 1, satFat: 0 },
  { keywords: ['杏鲍菇'], defaultGrams: 100, kcal: 35, protein: 3, carbs: 6, fat: 0.2, fiber: 2.5, sodium: 4, sugar: 1.5, satFat: 0 },
  { keywords: ['鸡腿菇'], defaultGrams: 100, kcal: 36, protein: 3, carbs: 6, fat: 0.2, fiber: 2, sodium: 5, sugar: 1, satFat: 0 },
  { keywords: ['榛蘑', '干榛蘑'], defaultGrams: 30, kcal: 30, protein: 3.5, carbs: 5, fat: 0.4, fiber: 4, sodium: 4, sugar: 0.5, satFat: 0 },
  { keywords: ['龙井茶叶', '龙井茶'], defaultGrams: 5, kcal: 280, protein: 25, carbs: 50, fat: 2, fiber: 18, sodium: 4, sugar: 0, satFat: 0.5 },
  { keywords: ['童子鸡', '小公鸡'], defaultGrams: 500, kcal: 200, protein: 22, carbs: 0, fat: 12, fiber: 0, sodium: 75, sugar: 0, satFat: 3.5 },
  { keywords: ['金针菇'], defaultGrams: 100, kcal: 32, protein: 2.4, carbs: 6, fat: 0.3, fiber: 2.7, sodium: 3, sugar: 2, satFat: 0 },
  { keywords: ['木耳', '黑木耳', '云耳'], defaultGrams: 30, kcal: 25, protein: 1.5, carbs: 6, fat: 0.2, fiber: 3.2, sodium: 5, sugar: 0, satFat: 0 },
  { keywords: ['海带', '海带结'], defaultGrams: 30, kcal: 25, protein: 1.7, carbs: 9, fat: 0.6, fiber: 1.3, sodium: 233, sugar: 0, satFat: 0 },
  { keywords: ['紫菜', '紫菜汤'], defaultGrams: 5, kcal: 35, protein: 26, carbs: 44, fat: 1, fiber: 21, sodium: 710, sugar: 0, satFat: 0 },
  { keywords: ['笋片', '笋干', '竹笋', '春笋', '冬笋'], defaultGrams: 150, kcal: 22, protein: 1, carbs: 5, fat: 0.1, fiber: 2.3, sodium: 1, sugar: 0, satFat: 0 },
  { keywords: ['青豆', '豌豆', '荷兰豆'], defaultGrams: 80, kcal: 84, protein: 5.4, carbs: 14, fat: 0.4, fiber: 2.9, sodium: 1, sugar: 5.7, satFat: 0.1 },
  { keywords: ['咸鱼'], defaultGrams: 30, kcal: 195, protein: 25, carbs: 0, fat: 10, fiber: 0, sodium: 5700, sugar: 0, satFat: 2.5 },
  { keywords: ['咸鸭蛋'], defaultGrams: 50, kcal: 190, protein: 13, carbs: 2, fat: 14, fiber: 0, sodium: 2700, sugar: 0, satFat: 4 },
  { keywords: ['皮蛋'], defaultGrams: 50, kcal: 158, protein: 13, carbs: 5, fat: 11, fiber: 0, sodium: 600, sugar: 1, satFat: 3 },
  { keywords: ['火腿'], defaultGrams: 30, kcal: 320, protein: 17, carbs: 2, fat: 27, fiber: 0, sodium: 2500, sugar: 0, satFat: 10 },
  { keywords: ['可乐'], defaultGrams: 300, kcal: 42, protein: 0, carbs: 11, fat: 0, fiber: 0, sodium: 4, sugar: 10.6, satFat: 0 },

  // —— 主食 ——
  { keywords: ['糙米饭', '白米饭', '米饭'], defaultGrams: 100, kcal: 116, protein: 2.6, carbs: 25, fat: 0.9, fiber: 0.8, sodium: 5, sugar: 0.1, satFat: 0.2 },
  { keywords: ['荞麦面'], defaultGrams: 60, kcal: 340, protein: 13, carbs: 71, fat: 3, fiber: 4, sodium: 1, sugar: 0, satFat: 0.5 },
  { keywords: ['面条', '挂面', '拉面'], defaultGrams: 60, kcal: 280, protein: 9, carbs: 60, fat: 0.5, fiber: 1, sodium: 200, sugar: 1, satFat: 0.1 },
  { keywords: ['藜麦'], defaultGrams: 80, kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, sodium: 7, sugar: 0, satFat: 0.2 },
  { keywords: ['玉米'], defaultGrams: 100, kcal: 86, protein: 4, carbs: 19, fat: 1.2, fiber: 2.7, sodium: 1, sugar: 3.2, satFat: 0.2 },
  { keywords: ['红薯', '地瓜'], defaultGrams: 150, kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sodium: 28, sugar: 4.2, satFat: 0 },
  { keywords: ['薏米', '薏仁'], defaultGrams: 30, kcal: 357, protein: 12, carbs: 70, fat: 5, fiber: 5, sodium: 1, sugar: 0, satFat: 1 },
  { keywords: ['花生米', '花生'], defaultGrams: 15, kcal: 567, protein: 26, carbs: 16, fat: 49, fiber: 8, sodium: 3, sugar: 4, satFat: 8 },
  { keywords: ['燕麦', '燕麦片'], defaultGrams: 40, kcal: 389, protein: 17, carbs: 66, fat: 7, fiber: 11, sodium: 2, sugar: 0, satFat: 1.2 },
  { keywords: ['小米'], defaultGrams: 50, kcal: 358, protein: 9, carbs: 75, fat: 3, fiber: 1.6, sodium: 4, sugar: 0, satFat: 0.5 },
  { keywords: ['全麦面包'], defaultGrams: 60, kcal: 247, protein: 13, carbs: 41, fat: 3, fiber: 7, sodium: 380, sugar: 5, satFat: 0.6 },
  { keywords: ['粉条', '粉丝', '红薯粉'], defaultGrams: 50, kcal: 340, protein: 0.5, carbs: 86, fat: 0.1, fiber: 0.6, sodium: 10, sugar: 0.5, satFat: 0 },
  { keywords: ['面粉'], defaultGrams: 50, kcal: 344, protein: 10, carbs: 73, fat: 1.1, fiber: 2.7, sodium: 2, sugar: 1, satFat: 0.2 },

  // —— 水果 / 干货 / 杂项 ——
  { keywords: ['菠萝', '凤梨'], defaultGrams: 100, kcal: 44, protein: 0.5, carbs: 11, fat: 0.1, fiber: 1.3, sodium: 1, sugar: 9, satFat: 0 },
  { keywords: ['柠檬'], defaultGrams: 30, kcal: 37, protein: 1.1, carbs: 9, fat: 0.3, fiber: 1.3, sodium: 1, sugar: 2.5, satFat: 0 },
  { keywords: ['银耳', '白木耳'], defaultGrams: 15, kcal: 200, protein: 10, carbs: 67, fat: 1.4, fiber: 31, sodium: 80, sugar: 0, satFat: 0 },
  { keywords: ['红枣', '大枣'], defaultGrams: 20, kcal: 276, protein: 1.8, carbs: 75, fat: 0.2, fiber: 6.7, sodium: 6, sugar: 67, satFat: 0 },
  { keywords: ['枸杞', '枸杞子'], defaultGrams: 5, kcal: 258, protein: 14, carbs: 47, fat: 2, fiber: 16, sodium: 250, sugar: 19, satFat: 0.1 },
  { keywords: ['醪糟', '米酒', '酒酿'], defaultGrams: 50, kcal: 100, protein: 1.6, carbs: 22, fat: 0.1, fiber: 0, sodium: 5, sugar: 18, satFat: 0 },

  // —— 调味（多为高钠 ——
  { keywords: ['橄榄油', '食用油', '香油', '菜籽油'], defaultGrams: 5, kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 2, sugar: 0, satFat: 14 },
  { keywords: ['生抽', '老抽', '蒸鱼豉油', '蚝油', '酱油', '酱油膏'], defaultGrams: 8, kcal: 35, protein: 8, carbs: 5, fat: 0, fiber: 0, sodium: 5700, sugar: 1, satFat: 0 },
  { keywords: ['料酒', '黄酒'], defaultGrams: 8, kcal: 35, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 2, sugar: 0, satFat: 0 },
  { keywords: ['香醋', '米醋', '陈醋', '醋'], defaultGrams: 8, kcal: 30, protein: 0, carbs: 6, fat: 0, fiber: 0, sodium: 300, sugar: 0.5, satFat: 0 },
  { keywords: ['淀粉', '玉米淀粉', '土豆淀粉', '红薯淀粉'], defaultGrams: 10, kcal: 350, protein: 0.3, carbs: 85, fat: 0.1, fiber: 0, sodium: 5, sugar: 0, satFat: 0 },
  { keywords: ['盐'], defaultGrams: 3, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 40000, sugar: 0, satFat: 0 },
  { keywords: ['白胡椒', '黑胡椒'], defaultGrams: 2, kcal: 250, protein: 10, carbs: 38, fat: 3, fiber: 25, sodium: 20, sugar: 0, satFat: 1 },
  { keywords: ['蒜', '蒜末', '蒜泥'], defaultGrams: 8, kcal: 149, protein: 4, carbs: 27, fat: 0.2, fiber: 1.5, sodium: 17, sugar: 1, satFat: 0 },
  { keywords: ['姜', '姜末', '姜片'], defaultGrams: 5, kcal: 80, protein: 1.8, carbs: 18, fat: 0.8, fiber: 5, sodium: 27, sugar: 1.7, satFat: 0 },
  { keywords: ['葱', '葱花', '葱末'], defaultGrams: 5, kcal: 32, protein: 2, carbs: 10, fat: 0.3, fiber: 3, sodium: 17, sugar: 2.5, satFat: 0 },
  { keywords: ['糖', '白糖', '冰糖', '红糖'], defaultGrams: 5, kcal: 387, protein: 0, carbs: 100, fat: 0, fiber: 0, sodium: 1, sugar: 100, satFat: 0 },
  { keywords: ['水', '温水', '热水', '清水', '冷水'], defaultGrams: 100, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0, satFat: 0 },
  { keywords: ['米粉', '米线', '河粉', '米皮'], defaultGrams: 100, kcal: 350, protein: 0.5, carbs: 80, fat: 0.5, fiber: 0.5, sodium: 5, sugar: 0, satFat: 0.1 },
  { keywords: ['糯米粉', '糯米'], defaultGrams: 80, kcal: 350, protein: 7, carbs: 78, fat: 1, fiber: 1, sodium: 1, sugar: 0, satFat: 0.2 },
  { keywords: ['粘米粉', '大米粉', '米粉粉'], defaultGrams: 100, kcal: 360, protein: 6, carbs: 80, fat: 0.8, fiber: 1, sodium: 2, sugar: 0, satFat: 0.2 },
  { keywords: ['澄粉', '小麦淀粉'], defaultGrams: 50, kcal: 350, protein: 0.3, carbs: 86, fat: 0, fiber: 0, sodium: 5, sugar: 0, satFat: 0 },
  { keywords: ['肠粉专用粉', '肠粉粉'], defaultGrams: 100, kcal: 345, protein: 8, carbs: 76, fat: 1, fiber: 2, sodium: 2, sugar: 0, satFat: 0.2 },
  { keywords: ['红豆', '赤豆'], defaultGrams: 50, kcal: 324, protein: 20, carbs: 63, fat: 0.6, fiber: 8, sodium: 2, sugar: 4, satFat: 0.1 },
  { keywords: ['绿豆'], defaultGrams: 50, kcal: 329, protein: 21, carbs: 62, fat: 0.8, fiber: 6, sodium: 2, sugar: 4, satFat: 0.1 },
  { keywords: ['黄豆', '大豆'], defaultGrams: 50, kcal: 390, protein: 35, carbs: 34, fat: 16, fiber: 9, sodium: 1, sugar: 7, satFat: 2.3 },
  { keywords: ['茶树菇'], defaultGrams: 50, kcal: 30, protein: 3, carbs: 5, fat: 0.2, fiber: 4, sodium: 4, sugar: 0, satFat: 0 },
  { keywords: ['海蜇', '海蜇皮'], defaultGrams: 100, kcal: 33, protein: 4, carbs: 1, fat: 0.3, fiber: 0, sodium: 1300, sugar: 0, satFat: 0 },
  { keywords: ['油面筋', '面筋'], defaultGrams: 80, kcal: 490, protein: 27, carbs: 35, fat: 25, fiber: 1, sodium: 600, sugar: 1, satFat: 5 },
  { keywords: ['青鱼', '草鱼', '鲫鱼', '鲤鱼', '罗非鱼', '鳜鱼'], defaultGrams: 200, kcal: 113, protein: 18, carbs: 0, fat: 4, fiber: 0, sodium: 60, sugar: 0, satFat: 0.8 },
  { keywords: ['鳝鱼', '黄鳝'], defaultGrams: 200, kcal: 89, protein: 18, carbs: 1.2, fat: 1.4, fiber: 0, sodium: 70, sugar: 0, satFat: 0.3 },
  { keywords: ['河虾', '河虾仁', '白米虾'], defaultGrams: 100, kcal: 85, protein: 18, carbs: 1.5, fat: 0.8, fiber: 0, sodium: 200, sugar: 0, satFat: 0.2 },
  { keywords: ['猪大肠', '大肠', '九转大肠用大肠'], defaultGrams: 100, kcal: 130, protein: 12, carbs: 0, fat: 9, fiber: 0, sodium: 80, sugar: 0, satFat: 3 },
  { keywords: ['猪蹄', '猪手', '猪肘', '猪蹄膀'], defaultGrams: 200, kcal: 240, protein: 22, carbs: 0, fat: 17, fiber: 0, sodium: 80, sugar: 0, satFat: 6 },
  { keywords: ['腊肉'], defaultGrams: 50, kcal: 500, protein: 22, carbs: 0, fat: 45, fiber: 0, sodium: 2000, sugar: 0, satFat: 15 },
  { keywords: ['酱板鸭', '酱鸭'], defaultGrams: 100, kcal: 280, protein: 22, carbs: 5, fat: 19, fiber: 0, sodium: 2400, sugar: 3, satFat: 6 },
  { keywords: ['午餐肉'], defaultGrams: 50, kcal: 220, protein: 10, carbs: 4, fat: 18, fiber: 0, sodium: 1200, sugar: 1, satFat: 7 },
  { keywords: ['腊肠', '广式腊肠'], defaultGrams: 50, kcal: 460, protein: 18, carbs: 5, fat: 40, fiber: 0, sodium: 2000, sugar: 2, satFat: 13 },
  { keywords: ['叉烧', '蜜汁叉烧'], defaultGrams: 80, kcal: 280, protein: 24, carbs: 8, fat: 16, fiber: 0, sodium: 800, sugar: 6, satFat: 5 },
  { keywords: ['咸蛋黄', '咸蛋黄'], defaultGrams: 30, kcal: 360, protein: 15, carbs: 4, fat: 32, fiber: 0, sodium: 1500, sugar: 0, satFat: 10 },
  { keywords: ['乌鸡', '乌骨鸡'], defaultGrams: 300, kcal: 195, protein: 22, carbs: 0, fat: 11, fiber: 0, sodium: 70, sugar: 0, satFat: 3.5 },
  { keywords: ['鲮鱼', '豆豉鲮鱼'], defaultGrams: 100, kcal: 100, protein: 18, carbs: 0, fat: 3, fiber: 0, sodium: 250, sugar: 0, satFat: 0.7 },
  { keywords: ['鱼丸', '福建鱼丸'], defaultGrams: 100, kcal: 90, protein: 12, carbs: 8, fat: 1, fiber: 0, sodium: 600, sugar: 0, satFat: 0.2 },
  { keywords: ['年糕', '宁波年糕', '韩式年糕'], defaultGrams: 150, kcal: 154, protein: 3, carbs: 33, fat: 0.5, fiber: 0.4, sodium: 250, sugar: 0, satFat: 0.1 },
  { keywords: ['雪菜', '雪里蕻'], defaultGrams: 100, kcal: 25, protein: 1.5, carbs: 4, fat: 0.3, fiber: 2, sodium: 1500, sugar: 0, satFat: 0 },
  { keywords: ['荠菜', '荠'], defaultGrams: 100, kcal: 31, protein: 2.9, carbs: 6, fat: 0.4, fiber: 1.7, sodium: 38, sugar: 1.7, satFat: 0 },
  { keywords: ['榨菜', '榨菜丝'], defaultGrams: 30, kcal: 30, protein: 1.5, carbs: 5, fat: 0.3, fiber: 1.5, sodium: 2400, sugar: 0, satFat: 0 },
  { keywords: ['桂花', '桂花酱'], defaultGrams: 5, kcal: 250, protein: 0, carbs: 65, fat: 0, fiber: 0, sodium: 0, sugar: 60, satFat: 0 },
  { keywords: ['陈皮'], defaultGrams: 3, kcal: 280, protein: 8, carbs: 60, fat: 2, fiber: 22, sodium: 10, sugar: 0, satFat: 0.3 },
  { keywords: ['红曲米', '红曲粉'], defaultGrams: 5, kcal: 360, protein: 20, carbs: 70, fat: 3, fiber: 4, sodium: 5, sugar: 0, satFat: 0.5 },
  { keywords: ['沙茶酱', '沙茶'], defaultGrams: 15, kcal: 480, protein: 12, carbs: 30, fat: 35, fiber: 3, sodium: 3500, sugar: 8, satFat: 8 },
  { keywords: ['黄酒', '花雕酒', '绍兴酒'], defaultGrams: 15, kcal: 95, protein: 0, carbs: 5, fat: 0, fiber: 0, sodium: 5, sugar: 0, satFat: 0 },
  { keywords: ['荷叶'], defaultGrams: 5, kcal: 200, protein: 10, carbs: 50, fat: 2, fiber: 25, sodium: 30, sugar: 0, satFat: 0 },
  { keywords: ['鸡蛋清', '蛋白'], defaultGrams: 33, kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, sodium: 55, sugar: 0.7, satFat: 0 },
  { keywords: ['绿豆芽', '豆芽'], defaultGrams: 100, kcal: 44, protein: 4.4, carbs: 8, fat: 0.2, fiber: 1.5, sodium: 5, sugar: 4, satFat: 0 },
  { keywords: ['蜂蜜'], defaultGrams: 5, kcal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0, sodium: 4, sugar: 82, satFat: 0 },
  { keywords: ['干辣椒', '辣椒'], defaultGrams: 5, kcal: 318, protein: 12, carbs: 57, fat: 17, fiber: 28, sodium: 9, sugar: 4, satFat: 3 },
  { keywords: ['鸭血', '鸭血豆腐'], defaultGrams: 100, kcal: 60, protein: 13, carbs: 0.5, fat: 0.3, fiber: 0, sodium: 170, sugar: 0, satFat: 0.1 },
  { keywords: ['鸭翅', '鸭胗'], defaultGrams: 150, kcal: 220, protein: 18, carbs: 0, fat: 16, fiber: 0, sodium: 75, sugar: 0, satFat: 4 },
  { keywords: ['甲鱼', '鳖'], defaultGrams: 300, kcal: 118, protein: 18, carbs: 0, fat: 5, fiber: 0, sodium: 70, sugar: 0, satFat: 1.5 },
  { keywords: ['咸肉', '腌肉'], defaultGrams: 100, kcal: 360, protein: 18, carbs: 0, fat: 32, fiber: 0, sodium: 1800, sugar: 0, satFat: 11 },
  { keywords: ['鹌鹑蛋'], defaultGrams: 100, kcal: 158, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sodium: 130, sugar: 1.1, satFat: 3.5 },
  { keywords: ['鸭胗', '鸭肫'], defaultGrams: 100, kcal: 110, protein: 19, carbs: 0.5, fat: 3, fiber: 0, sodium: 90, sugar: 0, satFat: 1 },
  { keywords: ['小米辣', '朝天椒', '线椒'], defaultGrams: 10, kcal: 40, protein: 1.9, carbs: 9, fat: 0.4, fiber: 3.7, sodium: 4, sugar: 5.3, satFat: 0 },
  { keywords: ['豆瓣酱', '郫县豆瓣', '辣豆瓣'], defaultGrams: 10, kcal: 180, protein: 7, carbs: 17, fat: 9, fiber: 2, sodium: 4800, sugar: 2, satFat: 1.2 },
  { keywords: ['豆豉'], defaultGrams: 10, kcal: 250, protein: 22, carbs: 28, fat: 8, fiber: 6, sodium: 4200, sugar: 1, satFat: 1.2 },
  { keywords: ['甜面酱'], defaultGrams: 10, kcal: 140, protein: 4, carbs: 28, fat: 1, fiber: 2, sodium: 2400, sugar: 14, satFat: 0.2 },
  { keywords: ['剁椒', '剁辣椒'], defaultGrams: 15, kcal: 35, protein: 1.5, carbs: 6, fat: 0.5, fiber: 2, sodium: 2300, sugar: 1, satFat: 0 },
  { keywords: ['泡椒', '泡辣椒'], defaultGrams: 15, kcal: 25, protein: 1, carbs: 5, fat: 0.3, fiber: 1.5, sodium: 1500, sugar: 1, satFat: 0 },
  { keywords: ['番茄酱'], defaultGrams: 15, kcal: 100, protein: 1.6, carbs: 23, fat: 0.3, fiber: 1.5, sodium: 900, sugar: 18, satFat: 0 },
  { keywords: ['花椒'], defaultGrams: 3, kcal: 258, protein: 11, carbs: 36, fat: 9, fiber: 28, sodium: 47, sugar: 0, satFat: 2 },
  { keywords: ['八角', '大料'], defaultGrams: 2, kcal: 250, protein: 4, carbs: 50, fat: 6, fiber: 14, sodium: 12, sugar: 0, satFat: 0.5 },
  { keywords: ['桂皮'], defaultGrams: 2, kcal: 260, protein: 4, carbs: 65, fat: 3, fiber: 53, sodium: 10, sugar: 0, satFat: 0.5 },
  { keywords: ['香叶'], defaultGrams: 1, kcal: 230, protein: 8, carbs: 50, fat: 8, fiber: 26, sodium: 20, sugar: 0, satFat: 2 },
  { keywords: ['辣椒粉', '辣椒面'], defaultGrams: 3, kcal: 318, protein: 12, carbs: 57, fat: 17, fiber: 28, sodium: 30, sugar: 4, satFat: 3 },
  { keywords: ['白芝麻', '黑芝麻'], defaultGrams: 3, kcal: 573, protein: 18, carbs: 23, fat: 50, fiber: 12, sodium: 5, sugar: 0, satFat: 7 },
  { keywords: ['芝麻', '白芝麻', '黑芝麻', '芝麻仁'], defaultGrams: 5, kcal: 573, protein: 18, carbs: 23, fat: 50, fiber: 12, sodium: 5, sugar: 0, satFat: 7 },
  { keywords: ['酵母', '酵母粉'], defaultGrams: 3, kcal: 325, protein: 40, carbs: 41, fat: 7, fiber: 26, sodium: 50, sugar: 0, satFat: 1 },
  { keywords: ['孜然粉'], defaultGrams: 3, kcal: 370, protein: 18, carbs: 44, fat: 22, fiber: 11, sodium: 170, sugar: 2, satFat: 2 },
  { keywords: ['五香粉'], defaultGrams: 2, kcal: 280, protein: 10, carbs: 50, fat: 8, fiber: 22, sodium: 50, sugar: 2, satFat: 1 },
  { keywords: ['芝麻酱'], defaultGrams: 10, kcal: 630, protein: 19, carbs: 22, fat: 53, fiber: 9, sodium: 1100, sugar: 0, satFat: 7 },

  // —— 兜底（关键词找不到时使用）——
  { keywords: ['__fallback__'], defaultGrams: 50, kcal: 50, protein: 2, carbs: 5, fat: 2, fiber: 0, sodium: 50, sugar: 1, satFat: 0.5 },
]

const FALLBACK_PROFILE = NUTRITION_PROFILES[NUTRITION_PROFILES.length - 1]

/**
 * 在 profile 列表里查找匹配关键词的营养 profile。
 * 第一个关键词命中就返回，没有则用兜底 profile。
 */
export function findProfile(name: string): NutritionProfile {
  for (const profile of NUTRITION_PROFILES) {
    for (const kw of profile.keywords) {
      if (kw === '__fallback__') continue
      if (name.includes(kw)) return profile
    }
  }
  return FALLBACK_PROFILE
}

/**
 * 把"100 克"数值换算成"actualGrams 克"的实际营养值。
 */
export function scaleNutrients(
  profile: NutritionProfile,
  actualGrams: number,
): NutritionProfile {
  const k = actualGrams / 100
  return {
    keywords: profile.keywords,
    defaultGrams: actualGrams,
    kcal: profile.kcal * k,
    protein: profile.protein * k,
    carbs: profile.carbs * k,
    fat: profile.fat * k,
    fiber: profile.fiber * k,
    sodium: profile.sodium * k,
    sugar: profile.sugar * k,
    satFat: profile.satFat * k,
  }
}

/**
 * 从"100 克 克"这种字符串中提取克数。
 * 支持 "200 克"、"250g"、"100g"、"75克" 等格式。
 */
export function parseGrams(amount: string): number {
  const m = amount.match(/(\d+(?:\.\d+)?)\s*(?:克|g|G)/)
  return m ? parseFloat(m[1]) : 0
}

/**
 * 汇总一道菜的所有食材营养。
 * dish 改动：返回包含全部 8 项字段的总和。
 */
export type DishNutrients = {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  sugar: number
  satFat: number
  grams: number
}

export function sumDishNutrients(
  ingredients: { name: string; amount: string }[],
): DishNutrients {
  const totals: DishNutrients = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    sugar: 0,
    satFat: 0,
    grams: 0,
  }
  for (const ing of ingredients) {
    const profile = findProfile(ing.name)
    const grams = parseGrams(ing.amount) || profile.defaultGrams
    const scaled = scaleNutrients(profile, grams)
    totals.kcal += scaled.kcal
    totals.protein += scaled.protein
    totals.carbs += scaled.carbs
    totals.fat += scaled.fat
    totals.fiber += scaled.fiber
    totals.sodium += scaled.sodium
    totals.sugar += scaled.sugar
    totals.satFat += scaled.satFat
    totals.grams += grams
  }
  return totals
}