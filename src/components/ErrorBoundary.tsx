/**
 * ErrorBoundary — 捕获 React 渲染异常，防白屏
 */
import { Component, type ReactNode } from 'react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch() {
    // 渲染错误只展示页面内兜底，不在生产环境留下 console 输出。
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">🍚</div>
            <h2>哎呀，饭团打翻了锅</h2>
            <p>
              页面出了点问题。别担心，你的数据都还在——刷新一下通常就能解决。
            </p>
            {this.state.error && (
              <details className="error-details">
                <summary>技术详情</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}
            <div className="error-actions">
              <button className="fd-btn fd-btn-primary" onClick={this.handleReload}>
                刷新页面
              </button>
              <button className="fd-btn fd-btn-secondary" onClick={this.handleGoHome}>
                返回首页
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
