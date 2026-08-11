import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useFandaziStore } from '@/stores/fandaziStore'
import { readHealthProfiles } from '@/components/healthProfileStorage'
import { checkPlateStructure } from '@/data/healthRecommend'
import { DISHES } from '@/data/dishes'
import { callFantuanAi, type FantuanContext, type FantuanChatMessage } from '@/lib/fantuanAiClient'
import { hasAiKey } from '@/lib/aiProviderConfig'
import { addHealthFacts, readHealthFacts, type HealthFactCategory } from '@/lib/healthFacts'
import { readBuddyGroup } from '@/data/familySharing'
import { readDailyMealSettings } from '@/data/dailyMeal'
import { FantuanIcon } from './FantuanIcon'
import { FantuanPetImage } from './FantuanPetImage'
import './FloatingFantuan.css'

type FantuanInsight = {
  message: string
  link?: string
  linkLabel?: string
  priority: 'high' | 'medium' | 'low'
}

type ChatMessage = {
  role: 'fantuan' | 'user'
  text: string
}

type Tab = 'chat' | 'taste' | 'insights'

const SPICY_LABELS = ['不辣', '微辣', '中辣', '重辣']
const SALTY_LABELS = ['清淡', '适中', '偏咸']
const SWEET_LABELS = ['不甜', '适中', '嗜甜']
const AVOID_OPTIONS = ['香菜', '内脏', '海鲜', '牛羊肉', '蛋奶', '豆制品', '坚果']

/** 根据口味偏好 + 上下文生成饭团语气回复 */
function generateFantuanReply(
  userText: string,
  tasteProfile: { spicy: number; salty: number; sweet: number; avoid: string[]; note: string },
  pantryCount: number,
): string {
  const lower = userText.toLowerCase()

  // 推荐类
  if (/推荐|吃什么|不知道|随便|建议/.test(lower)) {
    const spicyHint = tasteProfile.spicy >= 2 ? '偏辣' : tasteProfile.spicy === 0 ? '不辣' : '微辣'
    const avoidHint = tasteProfile.avoid.length > 0 ? `（避开${tasteProfile.avoid.join('、')}）` : ''
    return `按你${spicyHint}的口味${avoidHint}，去菜品库逛逛，我帮你标了「冰箱可做」和「搭子偏好」两个快捷筛选，点一下就能缩小范围。`
  }

  // 辣度相关
  if (/辣/.test(lower)) {
    return tasteProfile.spicy >= 2
      ? `知道你爱吃辣（${SPICY_LABELS[tasteProfile.spicy]}），菜品库用「搭子偏好」筛选就能看到够味的。`
      : `你平时口味偏${SPICY_LABELS[tasteProfile.spicy]}，要不要先试微辣的菜？告诉我你想吃肉还是素。`
  }

  // 清淡/健康
  if (/清淡|轻|健康|减脂|减肥/.test(lower)) {
    return `收到，按你${SALTY_LABELS[tasteProfile.salty]}的口味来。菜品库有「低油少盐」筛选，点一下就能看到适合的。`
  }

  // 冰箱相关
  if (/冰箱|有什么|食材|剩/.test(lower)) {
    return pantryCount > 0
      ? `你冰箱里有 ${pantryCount} 种食材，去菜品库点「冰箱可做」筛选，我帮你找能直接做的菜。`
      : `冰箱还是空的，先去冰箱页添几个食材吧，我才能帮你匹配能做的菜。`
  }

  // 计划/搭桌
  if (/计划|搭桌|今晚|明天|安排/.test(lower)) {
    return `好，去计划页把菜加进去，我会检查营养搭配缺什么，缺了会提醒你补一道。`
  }

  // 购物
  if (/买|购物|缺少|缺/.test(lower)) {
    return `去购物清单页，缺的食材我已经帮你列好了，勾一下就能标记已买。`
  }

  // 忌口
  if (/忌口|不吃|过敏|不能吃/.test(lower)) {
    return tasteProfile.avoid.length > 0
      ? `记着你忌口${tasteProfile.avoid.join('、')}，推荐时自动过滤。要改的话点「口味」标签。`
      : `在「口味」标签里把忌口勾上，我推荐时会自动避开。`
  }

  // 默认
  return `好的，我记着了。你可以试试：问我「今天吃什么」、说「看看冰箱」、或者去菜品库用筛选找菜～`
}

const QUICK_SUGGESTIONS = [
  '今天吃什么？',
  '看看冰箱',
  '安排今晚计划',
  '低油少盐的菜',
]

function useFantuanInsights() {
  const pantry = useFandaziStore((s) => s.pantry)
  const mealPlans = useFandaziStore((s) => s.mealPlans)
  const shoppingList = useFandaziStore((s) => s.shoppingList)
  const cookingLogs = useFandaziStore((s) => s.cookingLogs)
  const location = useLocation()
  const [healthProfileCount, setHealthProfileCount] = useState(() => readHealthProfiles().length)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHealthProfileCount(readHealthProfiles().length)
  }, [location.pathname])

  return useMemo<FantuanInsight[]>(() => {
    const insights: FantuanInsight[] = []
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // 页面相关活动统一进入右下角饭团浮层，不再把活动气泡插入正文。
    if (location.pathname === '/shopping') {
      const unchecked = shoppingList.filter((item) => !item.checked).length
      insights.push({
        message: unchecked > 0 ? `购物清单还有 ${unchecked} 项，买齐就能开做。` : '购物清单已经清空，想重新搭一桌吗？',
        link: '/plan',
        linkLabel: unchecked > 0 ? '回计划' : '重新搭桌',
        priority: unchecked > 0 ? 'medium' : 'low',
      })
    }

    if (location.pathname === '/family') {
      const group = readBuddyGroup()
      const hasCustomGroup = Boolean(localStorage.getItem('fandazi.buddyGroup'))
      insights.push({
        message: hasCustomGroup
          ? `今天由${group.members.find((member) => member.id === group.todayChefId)?.name || '掌勺人'}做决定，偏好冲突时我会把两边都列出来。`
          : '先设置饭搭子成员，我就能记住每个人的口味。',
        link: hasCustomGroup ? '/health' : '/family',
        linkLabel: hasCustomGroup ? '看健康档案' : '设置成员',
        priority: 'low',
      })
    }

    if (location.pathname === '/mine') {
      insights.push({
        message: cookingLogs.length > 0
          ? `已经做了 ${cookingLogs.length} 次饭，饭团会继续沉淀你家的口味。`
          : '做完一道菜后记得标记，我会帮你沉淀我家版。',
        link: '/plan',
        linkLabel: '去计划',
        priority: 'low',
      })
    }

    // 1. 冰箱快过期食材
    const expiringSoon = pantry.filter((item) => {
      if (!item.bestBeforeAt) return false
      const diff = (new Date(item.bestBeforeAt).getTime() - today.getTime()) / 86_400_000
      return diff <= 2 && diff >= -1
    })
    if (expiringSoon.length > 0) {
      const names = expiringSoon.slice(0, 3).map((i) => i.ingredientName).join('、')
      insights.push({
        message: `${names}快过期了，优先搭一桌吧。`,
        link: '/pantry',
        linkLabel: '看冰箱',
        priority: 'high',
      })
    }

    // 2. 今日真实计划缺口。没有计划时只提示安排，不注入示例菜。
    const todayPlans = mealPlans.filter((p) => p.planDate === todayStr)
    if (todayPlans.length === 0) {
      insights.push({
        message: '今天还没安排计划，先搭一版？',
        link: '/',
        linkLabel: '看今日推荐',
        priority: 'medium',
      })
    } else {
      const plannedDishes = todayPlans
        .map((p) => DISHES.find((d) => d.id === p.dishId))
        .filter(Boolean) as typeof DISHES
      const missingCount = plannedDishes.reduce((sum, dish) => (
        sum + dish.ingredients.filter((ingredient) => !pantry.some((item) => item.ingredientName === ingredient.name)).length
      ), 0)
      const plate = checkPlateStructure(plannedDishes)
      if (missingCount > 0) {
        insights.push({
          message: `今晚计划还缺 ${missingCount} 样食材，买齐就能开做。`,
          link: '/shopping',
          linkLabel: '看购物清单',
          priority: 'high',
        })
      } else if (plate.gaps.length > 0) {
        insights.push({
          message: `今天计划${plate.gaps.join('、')}，补一道？`,
          link: '/plan',
          linkLabel: '补缺口',
          priority: 'medium',
        })
      }
    }

    // 3. 健康问卷未填
    if (healthProfileCount === 0) {
      insights.push({
        message: '还没填健康问卷，推荐只按 2026 指南默认走。填了更精准。',
        link: '/health',
        linkLabel: '去填写',
        priority: 'low',
      })
    }

    // 按优先级排序
    const order = { high: 0, medium: 1, low: 2 }
    insights.sort((a, b) => order[a.priority] - order[b.priority])

    return insights.slice(0, 3)
  }, [pantry, mealPlans, shoppingList, cookingLogs, healthProfileCount, location.pathname])
}

export function FloatingFantuan() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('chat')
  const fantuan = useFandaziStore((s) => s.fantuan)
  const updateTasteProfile = useFandaziStore((s) => s.updateTasteProfile)
  const insights = useFantuanInsights()

  // AI 对话状态
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'fantuan', text: '我是饭团！想吃什么、想搭几桌，跟我说就行～' },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const pantryCount = useFandaziStore((s) => s.pantry.length)

  // 构建饭团上下文
  const buildContext = (): FantuanContext => {
    const state = useFandaziStore.getState()
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayPlans = state.mealPlans
      .filter((p) => p.planDate === todayStr)
      .map((p) => state.getDishById(p.dishId)?.name)
      .filter(Boolean) as string[]
    return {
      pantryItems: state.pantry.map((p) => p.ingredientName),
      todayPlans,
      tasteProfile: state.fantuan.tasteProfile,
      healthFacts: readHealthFacts().map((f) => ({ category: f.category, label: f.label })),
      healthProfiles: readHealthProfiles(),
      people: readDailyMealSettings().people,
      pageHint: location.pathname,
    }
  }

  // 统一发送消息（有 Key 调 AI，无 Key 回退本地）
  const sendMessage = async (text: string) => {
    setMessages((prev) => [...prev, { role: 'user', text }])
    setIsTyping(true)

    const useAi = hasAiKey()

    if (useAi) {
      // 调真实 AI
      const chatHistory: FantuanChatMessage[] = messages
        .filter((m) => m.text)
        .map((m) => ({
          role: m.role === 'fantuan' ? 'assistant' as const : 'user' as const,
          content: m.text,
        }))
      chatHistory.push({ role: 'user', content: text })

      const result = await callFantuanAi(chatHistory, buildContext())
      if (result.ok) {
        setMessages((prev) => [...prev, { role: 'fantuan', text: result.reply }])

        // 如果 AI 提取了健康事实，保存到健康档案
        if (result.healthFacts && result.healthFacts.length > 0) {
          const validCategories: HealthFactCategory[] = [
            'allergy', 'intolerance', 'condition', 'goal', 'medication', 'preference',
          ]
          const factsToAdd = result.healthFacts
            .filter((f) => validCategories.includes(f.category as HealthFactCategory))
            .map((f) => ({
              category: f.category as HealthFactCategory,
              label: f.label,
              detail: f.detail,
              sourceMessage: text,
            }))
          const added = addHealthFacts(factsToAdd)
          if (added.length > 0) {
            const labels = added.map((f) => f.label).join('、')
            setMessages((prev) => [
              ...prev,
              { role: 'fantuan', text: `📝 已记下你的健康信息：${labels}。去健康页可以看到完整档案。` },
            ])
          }
        }
      } else {
        // AI 失败时回退本地 + 提示
        const fallback = generateFantuanReply(text, fantuan.tasteProfile, pantryCount)
        setMessages((prev) => [...prev, { role: 'fantuan', text: `${fallback}\n\n⚠️ AI 连接失败（${result.error}），已回退本地回复` }])
      }
    } else {
      // 无 Key，本地回复
      const reply = generateFantuanReply(text, fantuan.tasteProfile, pantryCount)
      setMessages((prev) => [...prev, { role: 'fantuan', text: reply }])
    }
    setIsTyping(false)
  }

  const handleSend = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    setInput('')
    void sendMessage(trimmed)
  }

  const handleQuickSuggestion = (text: string) => {
    void sendMessage(text)
  }

  const tp = fantuan.tasteProfile

  return (
    <aside className={open ? 'floating-fantuan open' : 'floating-fantuan'} aria-label="全局饭团助手">
      {open && (
        <div className="fantuan-popover">
          {/* 头部 */}
          <div className="fantuan-popover-head">
            <div className="fantuan-head-left">
              <span className="fantuan-avatar"><FantuanPetImage state="default" /></span>
              <div>
                <strong>饭团</strong>
                <span className="fantuan-head-sub">
                  Lv.{fantuan.level} · 🌾{fantuan.mili}
                  {!hasAiKey() && ' · 本地模式'}
                </span>
              </div>
            </div>
            <button className="fantuan-close" onClick={() => setOpen(false)} aria-label="关闭">✕</button>
          </div>

          {/* Tab 栏 */}
          <div className="fantuan-tabs">
            <button className={`ft-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}><FantuanIcon name="chat" size={18} /> 对话</button>
            <button className={`ft-tab ${tab === 'taste' ? 'active' : ''}`} onClick={() => setTab('taste')}>👅 口味</button>
            <button className={`ft-tab ${tab === 'insights' ? 'active' : ''}`} onClick={() => setTab('insights')}>
              <FantuanIcon name="hint" size={18} /> 提醒{insights.some((i) => i.priority === 'high') && <span className="ft-tab-dot" />}
            </button>
          </div>

          {/* 对话 Tab */}
          {tab === 'chat' && (
            <div className="fantuan-chat">
              <div className="fantuan-chat-messages">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`ft-chat-msg ${msg.role}`}>
                    {msg.role === 'fantuan' && <span className="ft-chat-avatar"><FantuanPetImage state="chat" /></span>}
                    <span className="ft-chat-bubble">{msg.text}</span>
                  </div>
                ))}
                {isTyping && (
                  <div className="ft-chat-msg fantuan">
                    <span className="ft-chat-avatar"><FantuanPetImage state="thinking" /></span>
                    <span className="ft-chat-bubble ft-typing">
                      <span className="ft-typing-dot" />
                      <span className="ft-typing-dot" />
                      <span className="ft-typing-dot" />
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {/* 快捷建议 */}
              {messages.length <= 1 && !isTyping && (
                <div className="ft-quick-suggestions">
                  {QUICK_SUGGESTIONS.map((s) => (
                    <button key={s} className="ft-quick-chip" onClick={() => handleQuickSuggestion(s)}>{s}</button>
                  ))}
                </div>
              )}
              <form className="fantuan-chat-input" onSubmit={handleSend}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="跟饭团说点什么…"
                  aria-label="跟饭团对话"
                />
                <button type="submit" aria-label="发送" disabled={isTyping}>➤</button>
              </form>
              {!hasAiKey() && (
                <Link to="/sync" className="ft-local-mode-hint" onClick={() => setOpen(false)}>
                  🔧 当前为本地模式，点击配置 AI 让饭团更聪明
                </Link>
              )}
            </div>
          )}

          {/* 口味 Tab */}
          {tab === 'taste' && (
            <div className="fantuan-taste">
              <div className="ft-taste-row">
                <label>辣度</label>
                <div className="ft-taste-options">
                  {SPICY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      className={`ft-taste-chip ${tp.spicy === i ? 'active' : ''}`}
                      onClick={() => updateTasteProfile({ spicy: i as 0 | 1 | 2 | 3 })}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="ft-taste-row">
                <label>咸度</label>
                <div className="ft-taste-options">
                  {SALTY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      className={`ft-taste-chip ${tp.salty === i ? 'active' : ''}`}
                      onClick={() => updateTasteProfile({ salty: i as 0 | 1 | 2 })}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="ft-taste-row">
                <label>甜度</label>
                <div className="ft-taste-options">
                  {SWEET_LABELS.map((label, i) => (
                    <button
                      key={i}
                      className={`ft-taste-chip ${tp.sweet === i ? 'active' : ''}`}
                      onClick={() => updateTasteProfile({ sweet: i as 0 | 1 | 2 })}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="ft-taste-row">
                <label>忌口</label>
                <div className="ft-taste-options">
                  {AVOID_OPTIONS.map((opt) => {
                    const active = tp.avoid.includes(opt)
                    return (
                      <button
                        key={opt}
                        className={`ft-taste-chip ${active ? 'active' : ''}`}
                        onClick={() => {
                          const next = active
                            ? tp.avoid.filter((v) => v !== opt)
                            : [...tp.avoid, opt]
                          updateTasteProfile({ avoid: next })
                        }}
                      >{active ? '✓ ' : ''}{opt}</button>
                    )
                  })}
                </div>
              </div>
              <div className="ft-taste-row">
                <label>备注</label>
                <input
                  className="ft-taste-note"
                  value={tp.note}
                  onChange={(e) => updateTasteProfile({ note: e.target.value })}
                  placeholder="其他口味偏好…"
                />
              </div>
              <p className="ft-taste-hint">饭团会按这些口味帮你推荐菜品和搭桌。</p>
            </div>
          )}

          {/* 提醒 Tab */}
          {tab === 'insights' && (
            <div className="fantuan-insights">
              {insights.length > 0 ? (
                insights.map((insight, idx) => (
                  <div key={idx} className={`fantuan-insight ${insight.priority}`}>
                    <p>{insight.message}</p>
                    {insight.link && (
                      <Link to={insight.link} className="fantuan-insight-link" onClick={() => setOpen(false)}>{insight.linkLabel}</Link>
                    )}
                  </div>
                ))
              ) : (
                <p className="ft-no-insight">一切就绪，暂时没有提醒。去逛逛菜品吧～</p>
              )}
              <div className="fantuan-actions">
                <Link to="/plan" onClick={() => setOpen(false)}>看计划</Link>
                <Link to="/pantry" onClick={() => setOpen(false)}>看冰箱</Link>
                <Link to="/fantuan" onClick={() => setOpen(false)}>任务</Link>
              </div>
            </div>
          )}
        </div>
      )}
      <button className="fantuan-float-button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="饭团助手 - 点击对话">
        <span className="fantuan-face"><FantuanPetImage state="entry" /></span>
        {insights.some((i) => i.priority === 'high') && <span className="fantuan-pulse" />}
      </button>
    </aside>
  )
}
