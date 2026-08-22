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

// O'zbek tilidagi apostroflar so'zni bo'lmaydi: O'ktam, G'anijon.
// Shu sababli oddiy "capitalize" yaramaydi — u "G'Anijon" qilib yuboradi.
const APOSTROFLAR = "'’‘ʻʼ`´"
const AJRATGICHLAR = ' -–—/.'

/**
 * Ism-familiyani bosh harf bilan yozadi, qanday kiritilganidan qat'i nazar.
 * "aBduLLayev" -> "Abdullayev",  "g'ANIJON" -> "G'anijon"
 * Backend'dagi services/ism.py bilan bir xil qoida.
 */
export function ismTuzat(matn) {
  if (!matn) return matn
  let natija = ''
  let yangiSoz = true
  for (const ch of String(matn)) {
    if (AJRATGICHLAR.includes(ch)) {
      natija += ch
      yangiSoz = true
    } else if (APOSTROFLAR.includes(ch)) {
      natija += ch
    } else if (yangiSoz) {
      natija += ch.toUpperCase()
      yangiSoz = false
    } else {
      natija += ch.toLowerCase()
    }
  }
  return natija
}

export function paymentLabel(type) {
  switch (type) {
    case 'cash':
    case 'naqd':
      return '💵 Naqd'
    case 'card':
    case 'karta':
    case 'qr':
      return '💳 Karta / QR'
    case 'click':
    case 'payme':
      return '📱 Click/Payme'
    case 'split':
    case 'aralash':
      return '🔀 Aralash'
    case 'later':
    case 'keyinroq':
    case 'nasiya':
    case 'qarz':
      return '⏳ Keyinroq (Nasiya)'
    default:
      return type || 'Naqd'
  }
}


/**
 * Tug'ilgan sanadan faqat YILNI qaytaradi.
 *
 * Klinikada bemorning aniq kuni va oyi so'ralmaydi — faqat yili yozib
 * olinadi. Bazada esa `birth_date` to'liq sana ustuni, shuning uchun
 * yil `1989-01-01` ko'rinishida saqlanadi. Ekranda, chekda va hujjatlarda
 * o'sha "01-01" ko'rinib, chalkashtirardi: go'yo bemorning tug'ilgan kuni
 * 1-yanvar bo'lgandek. Endi hamma joyda faqat yil chiqadi.
 */
export function birthYear(v) {
  if (!v) return ''
  const s = String(v).trim()
  const m = s.match(/(\d{4})/)
  return m ? m[1] : ''
}
