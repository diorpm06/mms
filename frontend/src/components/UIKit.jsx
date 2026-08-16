/**
 * UIKit.jsx — Marjona Med CRM
 * Barcha sahifalarda ishlatish uchun yagona UI komponentlar to'plami.
 * Tugmalar, badge-lar, jadval sarlavhalari, bo'sh holat va sahifa headerini standartlashtiradi.
 */

import React from 'react'

// ─── ICONS (inline SVG — lucide-react o'rniga ham, har doim topiladi) ───────
export const Icons = {
  plus:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4"><path d="M12 5v14M5 12h14"/></svg>,
  edit:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  eye:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  check:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4"><polyline points="20 6 9 17 4 12"/></svg>,
  x:           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  bell:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  refresh:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  printer:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  download:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  search:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  // Sahifalarda ishlatilgan, lekin bu ro'yxatda yo'q edi — ikonka jimgina
  // ko'rinmasdan qolardi (Icons.catalog, Icons.creditCard, Icons.fileText).
  calendar:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  catalog:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  creditCard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  fileText:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  history:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-4H1"/><polyline points="1 2 1 8 7 8"/></svg>,
  money:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  arrowUp:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  arrowDown:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  folder:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  user:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  tv:          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>,
  save:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  cancel:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  package:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  externalLink:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  list:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  lock:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  chart:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
}

// ─── Btn ─────────────────────────────────────────────────────────────────────
// Hamma variant index.css dagi bitta asosdan foydalanadi — ilgari info/cyan/amber
// o'z ranglarini shu yerda yozardi va qolganlaridan farq qilardi (kun rejimida
// och rang oq fonda deyarli ko'rinmasdi).
const variantMap = {
  gold:    'btn-gold',
  outline: 'btn-outline',
  danger:  'btn-danger',
  rose:    'btn-rose',
  success: 'btn-success',
  emerald: 'btn-emerald',
  ghost:   'btn-ghost',
  info:    'btn-info',
  cyan:    'btn-cyan',
  amber:   'btn-amber',
}

// O'lcham endi index.css dagi modifikatorlar orqali — asos bilan mos keladi
const sizeMap = {
  '2xs': 'btn-xs',
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '',
  lg: 'px-5 py-2.5 text-base',
}

export function Btn({
  variant = 'gold',
  size = 'sm',
  icon: IconProp = null,
  loading = false,
  full = false,
  children,
  className = '',
  ...props
}) {
  const base = variantMap[variant] || variantMap.gold
  const sz   = sizeMap[size] || ''
  const sizeClass = sz

  const renderIcon = () => {
    if (!IconProp) return null
    if (React.isValidElement(IconProp)) {
      return <span className="flex-shrink-0">{IconProp}</span>
    }
    if (typeof IconProp === 'function' || typeof IconProp === 'object') {
      const Comp = IconProp
      return <Comp className="h-3.5 w-3.5 flex-shrink-0" />
    }
    return <span className="flex-shrink-0">{IconProp}</span>
  }

  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={`${base} ${sizeClass} ${full ? 'w-full' : ''} ${loading ? 'opacity-60 pointer-events-none' : ''} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
      ) : renderIcon()}
      {children}
    </button>
  )
}

// ─── PageHeader ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, icon: IconProp, children }) {
  const renderIcon = () => {
    if (!IconProp) return null
    if (React.isValidElement(IconProp)) {
      return <span className="flex-shrink-0 text-gold text-xl">{IconProp}</span>
    }
    if (typeof IconProp === 'function' || typeof IconProp === 'object') {
      const Comp = IconProp
      return <Comp className="h-6 w-6 flex-shrink-0 text-gold" />
    }
    return <span className="flex-shrink-0 text-gold text-xl">{IconProp}</span>
  }

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        {renderIcon()}
        <div>
          <h1 className="page-title mb-1">{title}</h1>
          {subtitle && <p className="text-muted text-sm">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase()
  let cls = 'badge-muted'
  let label = status

  if (['aktiv', 'active', 'tayyor', 'bajarildi', 'to\'langan'].includes(s)) {
    cls = 'badge-success'
    label = label || 'Aktiv'
  } else if (['kutilmoqda', 'pending', 'jarayonda'].includes(s)) {
    cls = 'badge-warning'
    label = label || 'Kutilmoqda'
  } else if (['bekor', 'cancelled', 'faolsiz', 'o\'chirilgan'].includes(s)) {
    cls = 'badge-danger'
    label = label || 'Bekor'
  }

  return <span className={`badge ${cls}`}>{label}</span>
}

// ─── THead ───────────────────────────────────────────────────────────────────
export function THead({ cols = [] }) {
  return (
    <thead className="bg-surface-2 text-muted uppercase text-[11px] font-bold tracking-wider">
      <tr>
        {cols.map((c, i) => (
          <th key={i} className="p-3 text-left border-b border-border">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ─── ActionRow ───────────────────────────────────────────────────────────────
export function ActionRow({ children }) {
  return <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📭', message = 'Ma\'lumot topilmadi', action = null }) {
  return (
    <div className="py-12 px-4 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-muted text-sm font-medium mb-4">{message}</p>
      {action}
    </div>
  )
}
