import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({ title, subtitle, backTo, backLabel = 'Orqaga', children }) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        {backTo && (
          <Link
            to={backTo}
            className="text-muted mb-2 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-body"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
        )}
        <h1 className="page-title mb-1">{title}</h1>
        {subtitle && <p className="text-muted text-sm">{subtitle}</p>}
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
