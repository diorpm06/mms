export function formatMoney(n) {
  if (n == null) return '0 so\'m'
  return `${Number(n).toLocaleString('uz-UZ')} so'm`
}

export function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}.${m}.${y}`
}

export function toISODate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('.')
  return `${y}-${m}-${d}`
}

export function paymentLabel(type) {
  return type === 'cash' ? 'Naqt' : 'Karta'
}
