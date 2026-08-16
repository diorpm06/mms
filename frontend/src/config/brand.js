/**
 * Klinika ma'lumotlari — YAGONA manba.
 *
 * Ilgari klinika nomi kod bo'ylab 5 xil yozilgan edi ("Marjona Med Service",
 * "Marjona Med Servis", "Marjona Med CRM", "Marjona Med Service CRM"...),
 * telefon raqami esa 7 xil formatda, ba'zi joyda umuman namuna raqam
 * (+998 90 123 45 67) qolib ketgandi. Chekda bir xil, ekranda boshqa xil
 * chiqardi.
 *
 * Nomi yoki raqami o'zgarsa — faqat shu faylni tahrirlang.
 */
export const BRAND = {
  // Rasmiy nom — chek, hisobot va bosma hujjatlarda shu ishlatiladi
  name: 'Marjona Med Servis',

  // Qisqa nom — tor joylarda (yon panel, telefon ekrani)
  nameShort: 'Marjona Med',

  // Tizim nomi — kirish sahifasi va sarlavhalarda
  system: 'Marjona Med Servis',

  tagline: "Sizning sog'lig'ingiz haqida qayg'uramiz",

  phone: '+998 (55) 604 44 24',
  phoneRaw: '+998556044424',

  logo: '/assets/logo.png',

  workHours: '08:00 — 18:00',
}

export default BRAND
