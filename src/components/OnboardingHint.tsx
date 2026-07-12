/**
 * 新手引导 — 首次打开时显示欢迎提示
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FantuanPetImage } from './FantuanPetImage'
import './OnboardingHint.css'

const STORAGE_KEY = 'fandazi.onboardingDismissed'

export function OnboardingHint() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) {
      const timer = setTimeout(() => setShow(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="onboarding-overlay" onClick={handleDismiss} role="dialog" aria-label="新手引导" aria-modal="true">
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-emoji"><FantuanPetImage state="happy" /></div>
        <h2>欢迎使用饭搭子！</h2>
        <p>让家人一起好好吃饭。这里是你的家庭做饭助手：</p>
        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="step-num">1</span>
            <span>看看<strong>菜品推荐</strong>，饭团帮你搭一桌</span>
          </div>
          <div className="onboarding-step">
            <span className="step-num">2</span>
            <span>去<strong>冰箱</strong>记录食材，看看能做什么</span>
          </div>
          <div className="onboarding-step">
            <span className="step-num">3</span>
            <span>选好的菜加入<strong>计划</strong>，自动生成购物清单</span>
          </div>
          <div className="onboarding-step">
            <span className="step-num">4</span>
            <span>做完标记，饭团帮你记住口味，沉淀成<strong>我家版</strong></span>
          </div>
        </div>
        <div className="onboarding-links">
          <Link to="/health" onClick={handleDismiss}>健康功能</Link>
          <span className="link-divider">·</span>
          <Link to="/family" onClick={handleDismiss}>设置家庭成员</Link>
          <span className="link-divider">·</span>
          <Link to="/privacy" onClick={handleDismiss}>隐私政策</Link>
        </div>
        <button className="fd-btn fd-btn-primary onboarding-start" onClick={handleDismiss}>
          开始用
        </button>
      </div>
    </div>
  )
}
