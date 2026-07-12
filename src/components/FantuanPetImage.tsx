import './FantuanPetImage.css'

export type FantuanPetState = 'default' | 'chat' | 'cooking' | 'entry' | 'happy' | 'reminder' | 'resting' | 'thinking'

const PET_PATHS: Record<FantuanPetState, string> = {
  default: '/icons/fantuan-states/fantuan-default.png',
  chat: '/icons/fantuan-states/fantuan-chat.png',
  cooking: '/icons/fantuan-states/fantuan-cooking.png',
  entry: '/icons/fantuan-states/fantuan-entry.png',
  happy: '/icons/fantuan-states/fantuan-happy.png',
  reminder: '/icons/fantuan-states/fantuan-reminder.png',
  resting: '/icons/fantuan-states/fantuan-resting.png',
  thinking: '/icons/fantuan-states/fantuan-thinking.png',
}

interface FantuanPetImageProps {
  state?: FantuanPetState
  className?: string
  label?: string
}

export function FantuanPetImage({ state = 'default', className = '', label = '' }: FantuanPetImageProps) {
  return (
    <img
      className={`fantuan-pet-image ${className}`.trim()}
      src={PET_PATHS[state]}
      alt={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
