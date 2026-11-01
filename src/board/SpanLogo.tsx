/** Two piers and the span between them; the USDC-blue stone is the deposit both sides hold up. */
export function SpanLogo({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  const ink = dark ? '#f3ecdf' : '#1d1a16'
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M10 56V30h12v26M42 56V30h12v26" fill={ink} />
      <path d="M8 30h48v-8H8z" fill={ink} />
      <path d="M26 12h12v10H26z" fill="#2775ca" />
    </svg>
  )
}
