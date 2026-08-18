import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Noma`lum xato' }
  }

  componentDidCatch(error, info) {
    console.error('UI runtime xato:', error, info)
    const msg = String(error?.message || '').toLowerCase()
    // Auto reload if version redeployment / chunk hash changed on Vercel
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('failed to fetch') ||
      msg.includes('importing a module script failed')
    ) {
      const lastReload = sessionStorage.getItem('last_chunk_reload_time')
      const now = Date.now()
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem('last_chunk_reload_time', String(now))
        window.location.reload()
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#09101f',
            color: '#e8eaf2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div style={{ maxWidth: 680, width: '100%', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 16, padding: 20, background: '#111827' }}>
            <h2 style={{ color: '#d4af37', marginBottom: 8 }}>Sahifa yuklanmadi</h2>
            <p style={{ opacity: 0.85, marginBottom: 12 }}>
              Brauzerda runtime xato yuz berdi. Quyidagi xabarni yuboring:
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#0b1224', padding: 12, borderRadius: 10 }}>
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ marginTop: 12, background: '#d4af37', color: '#0a0f1e', border: 'none', borderRadius: 10, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Qayta yuklash
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
