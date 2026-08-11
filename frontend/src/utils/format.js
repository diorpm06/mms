export function formatMoney(n) {
  if (n == null || isNaN(n)) return "0 so'm"
  const formatted = Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${formatted} so'm`
}

export function formatWithCommas(val) {
  if (val === '' || val == null) return ''
  const digits = String(val).replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function parseDigits(val) {
  if (val === '' || val == null) return 0
  const digits = String(val).replace(/\D/g, '')
  return parseInt(digits, 10) || 0
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
  switch (type) {
    case 'cash':
    case 'naqd':
      return '💵 Naqd'
    case 'card':
    case 'karta':
      return '💳 Karta'
    case 'click':
      return '📱 Click'
    case 'qr':
    case 'payme':
      return '🔳 QR Code'
    case 'later':
    case 'keyinroq':
    case 'nasiya':
    case 'qarz':
      return '⏳ Keyinroq (Nasiya)'
    default:
      return type || 'Naqd'
  }
}

