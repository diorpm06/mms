/** Naqt/karta pie uchun — nol qiymatlarni olib tashlaydi */
export function paymentPieData(cash, card, paymentChart) {
  const fromApi = (paymentChart || []).filter((d) => (d.value || 0) > 0)
  if (fromApi.length) return fromApi
  return [
    { name: 'Naqt',  value: cash || 0 },
    { name: 'Karta', value: card || 0 },
  ].filter((d) => d.value > 0)
}

export function hasPositiveValues(data, key = 'value') {
  return Array.isArray(data) && data.some((d) => (d[key] ?? d.total ?? d.income ?? 0) > 0)
}

export function truncateLabel(s, max = 14) {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** YAxis uchun qisqartirilgan format: 1500000 → "1.5M", 250000 → "250K" */
export function formatYAxis(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (value >= 1_000)     return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 0)}K`
  return String(value)
}

/** Tooltip custom label formatter */
export function moneyFormatter(value) {
  if (value == null) return '0'
  return `${Number(value).toLocaleString('uz-UZ')} so'm`
}
