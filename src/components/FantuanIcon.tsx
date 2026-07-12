import './FantuanIcon.css'

export type FantuanIconName =
  | 'home'
  | 'catalog'
  | 'chat'
  | 'takeout'
  | 'celebration'
  | 'growth'
  | 'draw'
  | 'hint'
  | 'buddy-collab'
  | 'checkin'
  | 'fail-share'
  | 'streak'
  | 'diamond'
  | 'challenge-copy'

const ICON_PATHS: Record<FantuanIconName, string> = {
  home: '/icons/fantuan-actions/fantuan-home.png',
  catalog: '/icons/fantuan-actions/fantuan-catalog.png',
  chat: '/icons/fantuan-actions/fantuan-chat.png',
  takeout: '/icons/fantuan-actions/fantuan-takeout.png',
  celebration: '/icons/fantuan-actions/fantuan-celebration.png',
  growth: '/icons/fantuan-actions/fantuan-growth.png',
  draw: '/icons/fantuan-actions/fantuan-draw.png',
  hint: '/icons/fantuan-actions/fantuan-hint.png',
  'buddy-collab': '/icons/fantuan-actions/fantuan-buddy-collab.png',
  checkin: '/icons/fantuan-actions/fantuan-checkin.png',
  'fail-share': '/icons/fantuan-actions/fantuan-fail-share.png',
  streak: '/icons/fantuan-actions/fantuan-streak.png',
  diamond: '/icons/fantuan-actions/fantuan-diamond.png',
  'challenge-copy': '/icons/fantuan-actions/fantuan-challenge-copy.png',
}

interface FantuanIconProps {
  name: FantuanIconName
  size?: number
  className?: string
  label?: string
}

export function FantuanIcon({ name, size = 22, className = '', label }: FantuanIconProps) {
  return (
    <img
      className={`fantuan-icon ${className}`.trim()}
      src={ICON_PATHS[name]}
      width={size}
      height={size}
      alt={label || ''}
      aria-hidden={label ? undefined : true}
    />
  )
}
