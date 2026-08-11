interface BrandLogoProps {
  size?: number
  className?: string
  label?: string
}

const BRAND_LOGO_VERSION = '20260803-logo-2'

export function BrandLogo({ size = 32, className = '', label = '饭搭子' }: BrandLogoProps) {
  return (
    <img
      src={`/brand-logo.png?v=${BRAND_LOGO_VERSION}`}
      alt={label}
      className={className}
      width={size}
      height={size}
      decoding="async"
    />
  )
}
