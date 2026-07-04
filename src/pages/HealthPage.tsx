/**
 * 健康档案 / 账户设置入口
 *
 * 公开 Demo 使用示例成员名；正式部署后由用户自定义家庭成员与健康问卷。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  readHealthProfiles,
  writeHealthProfiles,
  type HealthProfile,
  type HealthGoal,
  type HealthStatus,
  type DietRestriction,
  type NutritionFocus,
} from '@/components/healthProfileStorage'
import './HealthPage.css'

const now = Date.now()

const DEMO_PROFILES: HealthProfile[] = [
  {
    id: 'demo-xia',
    name: '小夏',
    role: 'owner',
    goals: ['light-diet', 'meal-planning'],
    healthStatuses: ['general-healthy-eating'],
    restrictions: ['low-oil', 'low-sodium'],
    nutritionFocus: ['protein', 'fiber', 'sodium'],
    priorityGoals: ['meal-planning'],
    reportNotes: '公开 Demo 示例成员，正式使用时请改成自己的家庭成员。',
    notes: '偏好家常、快手、少油少盐。',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-chuan',
    name: '阿川',
    role: 'family',
    goals: ['sugar-control', 'light-diet'],
    healthStatuses: ['glucose-fluctuation'],
    restrictions: ['low-sugar', 'low-refined-carb', 'avoid-heavy-flavor'],
    nutritionFocus: ['sugar', 'post-meal-glucose', 'fiber'],
    priorityGoals: ['sugar-control'],
    reportNotes: '公开 Demo 示例成员，真实 ID / 昵称由用户自行设置。',
    notes: '晚餐更适合清淡、低油、主食适量。',
    createdAt: now,
    updatedAt: now,
  },
]

const GOAL_LABEL: Record<HealthGoal, string> = {
  'fat-loss': '减脂',
  'sugar-control': '控糖',
  'fatty-liver-friendly': '脂肪肝友好',
  'blood-lipid-control': '血脂管理',
  'blood-pressure-control': '血压管理',
  'muscle-gain': '增肌',
  'light-diet': '清淡饮食',
  'meal-planning': '省心计划',
  'shopping-efficiency': '少浪费少采购',
  'more-variety': '食物多样',
}

const STATUS_LABEL: Record<HealthStatus, string> = {
  'losing-weight': '减重中',
  overweight: '体重管理',
  prediabetes: '糖前期关注',
  'glucose-fluctuation': '血糖波动',
  'fatty-liver': '脂肪肝',
  'high-blood-lipid': '血脂偏高',
  'high-blood-pressure': '血压偏高',
  'high-uric-acid': '尿酸偏高',
  anemia: '贫血关注',
  thyroid: '甲状腺关注',
  gastritis: '胃部敏感',
  kidney: '肾脏限制',
  'low-activity': '活动量低',
  'high-activity': '活动量高',
  'sensitive-stomach': '肠胃敏感',
  'general-healthy-eating': '日常健康饮食',
}

const RESTRICTION_LABEL: Record<DietRestriction, string> = {
  'low-sugar': '低糖',
  'low-oil': '少油',
  'low-fat': '低脂',
  'low-sodium': '少盐',
  'low-refined-carb': '少精制碳水',
  'low-purine': '低嘌呤',
  'calorie-control': '控热量',
  'avoid-fried': '少油炸',
  'avoid-sugary-drinks': '避开含糖饮料',
  'avoid-fatty-meat': '少肥肉',
  'avoid-heavy-flavor': '少重口',
  'avoid-raw': '少生冷',
  'avoid-cold': '少冰冷',
  'no-spicy': '不辣',
  'no-seafood': '不海鲜',
  'no-beef-lamb': '不牛羊',
  'no-egg': '不蛋',
  'no-dairy': '不奶',
  'no-gluten': '无麸质',
  'no-nuts': '不坚果',
  vegetarian: '素食',
}

const FOCUS_LABEL: Record<NutritionFocus, string> = {
  kcal: '热量',
  calories: '热量',
  protein: '蛋白质',
  carbs: '碳水',
  fat: '脂肪',
  fiber: '膳食纤维',
  sugar: '糖',
  sodium: '钠',
  satFat: '饱和脂肪',
  iron: '铁',
  calcium: '钙',
  'vitamin-c': '维 C',
  potassium: '钾',
  purine: '嘌呤',
  cholesterol: '胆固醇',
  'post-meal-glucose': '餐后血糖',
}

function labels<T extends string>(values: T[], dict: Record<T, string>) {
  return values.map((value) => dict[value] ?? value)
}

export function HealthPage() {
  const [profiles, setProfiles] = useState<HealthProfile[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfiles(readHealthProfiles())
  }, [])

  const displayProfiles = profiles.length > 0 ? profiles : DEMO_PROFILES
  const isDemo = profiles.length === 0

  const combinedRestrictions = useMemo(() => (
    Array.from(new Set(displayProfiles.flatMap((profile) => profile.restrictions)))
  ), [displayProfiles])

  const saveDemoProfiles = () => {
    writeHealthProfiles(DEMO_PROFILES.map((profile) => ({ ...profile, createdAt: Date.now(), updatedAt: Date.now() })))
    setProfiles(readHealthProfiles())
    setSaved(true)
  }

  const resetToDemo = () => {
    writeHealthProfiles([])
    setProfiles([])
    setSaved(false)
  }

  return (
    <div className="health-page">
      <section className="health-hero">
        <div className="fd-hero-card health-hero-main">
          <div className="hero-label">健康档案 · 账户设置入口</div>
          <h2>先填家庭成员健康问卷，再让饭团按 2026 膳食指南配餐</h2>
          <p>
            公开 Demo 用“小夏 / 阿川”演示。正式部署后，成员昵称、健康目标、忌口和 AI Key 都由用户自己配置，推荐逻辑再叠加到每日配餐里。
          </p>
          <div className="cta-row">
            <button className="fd-btn fd-btn-primary" onClick={saveDemoProfiles}>保存示例健康档案</button>
            <button className="fd-btn fd-btn-secondary" onClick={resetToDemo}>恢复公开 Demo</button>
          </div>
          {saved && <p className="health-save-note">已写入本机 localStorage：fandazi.healthProfiles</p>}
        </div>
        <aside className="fd-side-card health-mode-card">
          <div className="hero-label">当前模式</div>
          <div className="health-line"><span>{isDemo ? '公开 Demo' : '私人本机档案'}</span><strong>{displayProfiles.length} 人</strong></div>
          <div className="health-line"><span>数据位置</span><strong>localStorage</strong></div>
          <div className="health-line"><span>AI Key</span><strong>用户自配</strong></div>
        </aside>
      </section>

      <section className="fd-panel health-guide-panel">
        <div>
          <div className="hero-label">默认推荐底座</div>
          <h3>《中国居民膳食指南》2026 版口径</h3>
          <p>没有健康问卷时，也不能随机推菜；默认要按“食物多样、谷薯类、蔬果、奶豆、适量鱼禽蛋瘦肉、少盐少油控糖”的日常原则搭一桌。</p>
        </div>
        <div className="plate-grid">
          <div><strong>优质蛋白</strong><span>鱼禽蛋瘦肉 / 豆制品</span></div>
          <div><strong>足量蔬菜</strong><span>深色蔬菜优先，兼顾菌菇</span></div>
          <div><strong>适量主食</strong><span>全谷物 / 薯类可替代精制主食</span></div>
          <div><strong>风险控制</strong><span>少盐、少油、少糖、少重口</span></div>
        </div>
      </section>

      <div className="health-workspace">
        <section className="fd-panel">
          <div className="section-heading">
            <div>
              <div className="hero-label">家庭成员健康问卷</div>
              <h3>{isDemo ? '示例成员，不是你的真实 ID' : '私人健康档案'}</h3>
            </div>
            <span className="fd-badge gold">可自定义</span>
          </div>
          <div className="profile-grid">
            {displayProfiles.map((profile) => (
              <article key={profile.id} className="health-profile-card">
                <div className="profile-title">
                  <strong>{profile.name}</strong>
                  <span>{profile.role === 'owner' ? '主账号' : profile.role === 'family' ? '家庭成员' : '临时用餐人'}</span>
                </div>
                <div className="chip-row">
                  {labels(profile.goals, GOAL_LABEL).map((item) => <span key={item} className="health-chip green">{item}</span>)}
                </div>
                <div className="chip-row">
                  {labels(profile.healthStatuses, STATUS_LABEL).map((item) => <span key={item} className="health-chip">{item}</span>)}
                </div>
                <div className="chip-row">
                  {labels(profile.nutritionFocus, FOCUS_LABEL).map((item) => <span key={item} className="health-chip">关注：{item}</span>)}
                </div>
                <div className="profile-note">{profile.notes}</div>
              </article>
            ))}
          </div>
        </section>

        <aside className="health-side">
          <section className="fd-side-card">
            <h4>推荐会避开什么</h4>
            <div className="chip-row vertical">
              {labels(combinedRestrictions, RESTRICTION_LABEL).map((item) => <span key={item} className="health-chip red">{item}</span>)}
            </div>
          </section>
          <section className="fd-side-card fantuan-reminder">
            <h4>🍙 饭团说明</h4>
            <div className="fd-bubble">
              我以后推荐一桌饭时，会先按 2026 膳食指南搭底座，再叠加每个成员的健康问卷；Demo 只是示例，正式昵称和限制都由你自己填。
            </div>
          </section>
          <section className="fd-side-card">
            <h4>下一步接 AI</h4>
            <p className="health-small">用户部署自己的版本后，在 AI 厨房填自己的 API Key。AI 只读取本机健康档案和冰箱/计划数据，不使用公开 Demo 数据。</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
