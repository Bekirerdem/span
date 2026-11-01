/** Two piers and the span between them; the amber stone is the deposit both sides hold up. */
export function SpanLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M10 56V30h12v26M42 56V30h12v26" fill="#F2EADB" />
      <path d="M8 30h48v-8H8z" fill="#F2EADB" />
      <path d="M26 12h12v10H26z" fill="#FFB547" />
    </svg>
  )
}

/** The USDC mark, the one place the USDC blue appears. */
export function UsdcMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="usdc-mark">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        d="M20.4 18.4c0-2.3-1.4-3.1-4.2-3.4-2-.3-2.4-.8-2.4-1.7s.7-1.5 2-1.5c1.2 0 1.9.4 2.2 1.4.1.2.3.3.5.3h1.1c.3 0 .5-.2.5-.5v-.1c-.3-1.4-1.4-2.5-2.9-2.6V8.7c0-.3-.2-.5-.5-.6h-1c-.3 0-.5.2-.6.6v1.6c-2 .3-3.3 1.6-3.3 3.3 0 2.2 1.3 3.1 4.1 3.4 1.9.4 2.5.8 2.5 1.8s-.9 1.7-2.1 1.7c-1.7 0-2.3-.7-2.5-1.7-.1-.3-.3-.4-.5-.4h-1.2c-.3 0-.5.2-.5.5v.1c.3 1.6 1.3 2.7 3.5 3.1v1.6c0 .3.2.5.5.6h1c.3 0 .5-.2.6-.6v-1.6c2-.3 3.4-1.7 3.4-3.5z"
        fill="#fff"
      />
    </svg>
  )
}
