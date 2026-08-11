import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { completeAuthHandoff, grantAuthHandoffAccess } from '@/lib/authHandoff'
import './AuthHandoffScanner.css'

const SCANNER_REGION_ID = 'auth-handoff-scanner-region'

type ScannerState = 'idle' | 'starting' | 'scanning' | 'completing' | 'success' | 'error'

function getTokenFromScan(decodedText: string): string | null {
  const value = decodedText.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    const token = url.searchParams.get('auth_handoff')?.trim()
    return token || null
  } catch {
    // 兼容以后二维码只放一次性 token 的情况，但不接受过短内容。
    return value.length >= 20 ? value : null
  }
}

function getCameraErrorMessage(error: unknown): string {
  const errorName = error instanceof DOMException
    ? error.name
    : error instanceof Error
      ? error.name
      : ''
  const errorText = typeof error === 'string'
    ? error
    : error instanceof Error
      ? `${error.name} ${error.message}`
      : ''

  if (!window.isSecureContext || /insecure|https|secure context/i.test(errorText)) {
    return '当前页面不是安全的 HTTPS 摄像头环境，请从正式网址打开饭搭子。'
  }
  if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || /permission|denied|not allowed/i.test(errorText)) {
    return '当前打开方式没有获得摄像头授权。若你是从主屏幕图标打开，请先用 Safari 打开正式网址一次，再点击扫码。'
  }
  if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError' || errorName === 'NoCamera') {
    return '当前页面没有找到摄像头，请确认手机摄像头没有被系统关闭。'
  }
  if (errorName === 'NotReadableError' || errorName === 'TrackStartError' || errorName === 'AbortError') {
    return '摄像头暂时被其他应用占用，请关闭相机、视频通话或其他浏览器页面后重试。'
  }
  if (errorName === 'OverconstrainedError') {
    return '手机后置摄像头约束不兼容，正在使用另一种方式重试。'
  }
  if (errorName) {
    return `摄像头启动失败（${errorName}），请关闭当前页面后重新打开正式网址。`
  }
  return '摄像头启动失败，请先用 Safari 打开正式网址，再点击扫码重试。'
}

async function getPreferredCameraId(): Promise<string> {
  const cameras = await Html5Qrcode.getCameras()
  if (cameras.length === 0) throw new Error('NoCamera')

  const rearCamera = cameras.find((camera) => /back|rear|environment|后置|背面/i.test(camera.label))
  return (rearCamera ?? cameras[0]).id
}

export function AuthHandoffScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const [state, setState] = useState<ScannerState>('idle')
  const [error, setError] = useState('')

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return

    try {
      if (scanner.isScanning) await scanner.stop()
    } catch {
      // 摄像头已经被系统回收时，页面仍可正常继续登录。
    }
    try {
      scanner.clear()
    } catch {
      // 清理失败不影响接力结果。
    }
  }, [])

  const handleDecodedText = useCallback(async (decodedText: string) => {
    if (handledRef.current) return

    const token = getTokenFromScan(decodedText)
    if (!token) {
      setError('这不是饭搭子的接力二维码，请对准电脑上刚生成的二维码。')
      setState('error')
      return
    }

    handledRef.current = true
    setState('completing')
    await stopScanner()

    try {
      const result = await completeAuthHandoff(token)
      if (result.error) {
        handledRef.current = false
        setState('error')
        setError(result.error)
        return
      }

      grantAuthHandoffAccess()
      setState('success')
      window.setTimeout(() => window.location.replace('/'), 450)
    } catch {
      handledRef.current = false
      setState('error')
      setError('接力登录暂时没有完成，请回电脑重新生成二维码后再试。')
    }
  }, [stopScanner])

  const startScanner = useCallback(async () => {
    if (scannerRef.current || state === 'starting' || state === 'scanning' || state === 'completing') return

    setError('')
    setState('starting')
    handledRef.current = false

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError('摄像头扫码需要从公开 HTTPS 网站打开饭搭子。')
      return
    }

    const scanner = new Html5Qrcode(SCANNER_REGION_ID)
    scannerRef.current = scanner

    try {
      // 先让浏览器完成一次真实的摄像头授权和设备枚举，再用设备 ID 启动。
      // 直接把 facingMode 传给 iOS Safari/PWA 在部分版本上会被拒绝，即使权限已经打开。
      const cameraId = await getPreferredCameraId()
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
        (decodedText) => void handleDecodedText(decodedText),
        () => undefined,
      )
      setState('scanning')
    } catch (cause) {
      scannerRef.current = null
      try {
        scanner.clear()
      } catch {
        // 初始化失败时没有可清理的扫描区域。
      }
      setState('error')
      setError(getCameraErrorMessage(cause))
    }
  }, [handleDecodedText, state])

  useEffect(() => () => {
    void stopScanner()
  }, [stopScanner])

  return (
    <div className="auth-handoff-scanner">
      <div className="auth-handoff-scanner-copy">
        <strong>手机端直接扫描电脑二维码</strong>
        <span>在这里打开手机摄像头，对准电脑上的二维码；扫描成功后会自动完成登录。</span>
      </div>

      <button
        type="button"
        className="auth-handoff-scanner-trigger"
        onClick={() => void startScanner()}
        disabled={state === 'starting' || state === 'scanning' || state === 'completing'}
      >
        {state === 'starting' ? '正在打开摄像头…' : state === 'scanning' ? '正在扫描…' : '扫描电脑二维码登录'}
      </button>

      <div id={SCANNER_REGION_ID} className="auth-handoff-scanner-view" aria-label="二维码扫描区域" />

      {(state === 'scanning' || state === 'starting') && (
        <p className="auth-handoff-scanner-status">请把电脑上的二维码放入取景框内。</p>
      )}
      {state === 'completing' && <p className="auth-handoff-scanner-status">二维码已识别，正在完成登录…</p>}
      {state === 'success' && <p className="auth-handoff-scanner-success">登录成功，正在进入饭搭子…</p>}
      {state === 'error' && (
        <div className="auth-handoff-scanner-error">
          <p>{error}</p>
          <button type="button" onClick={() => void startScanner()}>重新打开摄像头</button>
        </div>
      )}
    </div>
  )
}
