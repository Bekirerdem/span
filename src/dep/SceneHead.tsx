import type { ReactNode } from 'react'

/** The one scene head: amber kicker, H2 title, optional lead. Spacing comes from the type system (index.css). */
export function SceneHead({ kicker, title, lead, className = '' }: { kicker: string; title?: ReactNode; lead?: ReactNode; className?: string }) {
  return (
    <header className={`scene-head ${className}`}>
      <p className="kicker">{kicker}</p>
      {title && <h2 className="display h2">{title}</h2>}
      {lead && <p className="lead">{lead}</p>}
    </header>
  )
}
