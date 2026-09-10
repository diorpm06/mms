import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, MapPin, Clock, Instagram, Send, User, Menu, X, ChevronRight, Moon, Sun,
  Waves, FlaskConical, Zap, Sparkles, Syringe, Brain, Atom, Droplet, Sun as SunIcon,
  ShieldCheck, CalendarCheck, Stethoscope, CheckCircle2,
} from 'lucide-react'
import logo from '@assets/logo.png'
import heroImage from '@assets/hero-uzi.jpg'
import whyImage from '@assets/clinic-interior.jpg'
import { BRAND } from '../config/brand'
import { useTheme } from '../hooks/useTheme'
import { useAuthStore } from '../store/authStore'

const SERVICE_ICONS = [
  { Icon: Waves, color: '#2563eb' },
  { Icon: FlaskConical, color: '#0d9488' },
  { Icon: Zap, color: '#d97706' },
  { Icon: Sparkles, color: '#c026d3' },
  { Icon: Syringe, color: '#dc2626' },
  { Icon: Brain, color: '#7c3aed' },
  { Icon: Atom, color: '#0891b2' },
  { Icon: Droplet, color: '#e11d48' },
  { Icon: SunIcon, color: '#ea580c' },
]

const LANGS = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

const T = {
  uz: {
    navServices: 'Xizmatlar', navWhy: 'Biz haqimizda', navContact: 'Aloqa',
    call: "Qo'ng'iroq qilish", profile: 'Profil',
    eyebrow: "Sog'lig'ingiz — bizning ustuvorligimiz",
    heroTitle1: 'Aniq tashxis.', heroTitle2: 'Ishonchli davo.',
    heroDesc: `${BRAND.tagline} — ${BRAND.name}da zamonaviy uskunalar va tajribali shifokorlar sizga xizmat qiladi.`,
    seeServices: 'Xizmatlarni ko\'rish',
    licensed: 'Litsenziyalangan', clinic: 'klinika', daily: 'Har kuni',
    quickBook: 'Qabulga yozilish', quickBookDesc: 'Telefon orqali navbat oling',
    quickServices: 'Xizmatlarimiz', quickServicesDesc: "Barcha yo'nalishlar",
    quickAddress: 'Manzilimiz', quickHours: 'Ish vaqti',
    servicesEyebrow: 'Xizmatlarimiz', servicesTitle1: "To'liq tibbiy", servicesTitle2: 'xizmatlar',
    servicesDesc: 'Zamonaviy uskunalar va tajribali mutaxassislar bilan aniq tashxis va sifatli davolash',
    statSpecialists: 'Mutaxassis shifokor', statServices: 'Xizmat yo\'nalishi', statHours: 'Har kuni ish vaqti', statEquip: 'Zamonaviy uskunalar',
    whyEyebrow: 'Nega bizni tanlashadi',
    whyDesc: "Har bir bemorimizga e'tibor va aniq tashxis bilan yondashamiz — sog'lig'ingiz biz uchun ustuvor.",
    why: [
      'Tajribali va malakali shifokorlar',
      'Zamonaviy tashxis uskunalari (UZI, laboratoriya)',
      'Har kuni qabul, navbat kutish minimal',
      "Aniq va tez tayyor bo'ladigan natijalar",
    ],
    contactNow: "Hoziroq bog'laning",
    address: 'Manzil', hours: 'Ish vaqti', phone: 'Telefon',
    rights: 'Barcha huquqlar himoyalangan.',
    services: [
      'UZI (Ultratovush)', 'Laboratoriya', 'Fizioterapiya', 'Massaj', 'Ineksiya',
      'Nevrologiya', 'Ozonaterapiya', 'Endokrinologiya', 'Fototerapiya',
    ],
  },
  ru: {
    navServices: 'Услуги', navWhy: 'О нас', navContact: 'Контакты',
    call: 'Позвонить', profile: 'Профиль',
    eyebrow: 'Ваше здоровье — наш приоритет',
    heroTitle1: 'Точная диагностика.', heroTitle2: 'Надёжное лечение.',
    heroDesc: `${BRAND.tagline} — в ${BRAND.name} вам помогут современное оборудование и опытные врачи.`,
    seeServices: 'Смотреть услуги',
    licensed: 'Лицензированная', clinic: 'клиника', daily: 'Ежедневно',
    quickBook: 'Записаться на приём', quickBookDesc: 'Позвоните и запишитесь',
    quickServices: 'Наши услуги', quickServicesDesc: 'Все направления',
    quickAddress: 'Наш адрес', quickHours: 'Часы работы',
    servicesEyebrow: 'Наши услуги', servicesTitle1: 'Полный спектр', servicesTitle2: 'медицинских услуг',
    servicesDesc: 'Точная диагностика и качественное лечение с современным оборудованием и опытными специалистами',
    statSpecialists: 'Врачей-специалистов', statServices: 'Направлений услуг', statHours: 'Ежедневный график', statEquip: 'Современное оборудование',
    whyEyebrow: 'Почему выбирают нас',
    whyDesc: 'К каждому пациенту — внимание и точная диагностика. Ваше здоровье для нас в приоритете.',
    why: [
      'Опытные и квалифицированные врачи',
      'Современное диагностическое оборудование (УЗИ, лаборатория)',
      'Приём каждый день, минимальное ожидание',
      'Точные и быстрые результаты',
    ],
    contactNow: 'Связаться сейчас',
    address: 'Адрес', hours: 'Часы работы', phone: 'Телефон',
    rights: 'Все права защищены.',
    services: [
      'УЗИ (Ультразвук)', 'Лаборатория', 'Физиотерапия', 'Массаж', 'Инъекции',
      'Неврология', 'Озонотерапия', 'Эндокринология', 'Фототерапия',
    ],
  },
  en: {
    navServices: 'Services', navWhy: 'About Us', navContact: 'Contact',
    call: 'Call Now', profile: 'Profile',
    eyebrow: 'Your health, our priority',
    heroTitle1: 'Accurate diagnosis.', heroTitle2: 'Trusted care.',
    heroDesc: `${BRAND.tagline} — at ${BRAND.name}, modern equipment and experienced doctors are here for you.`,
    seeServices: 'View services',
    licensed: 'Licensed', clinic: 'clinic', daily: 'Open daily',
    quickBook: 'Book an appointment', quickBookDesc: 'Call to reserve a slot',
    quickServices: 'Our services', quickServicesDesc: 'All departments',
    quickAddress: 'Our address', quickHours: 'Working hours',
    servicesEyebrow: 'Our services', servicesTitle1: 'Complete medical', servicesTitle2: 'services',
    servicesDesc: 'Accurate diagnosis and quality care with modern equipment and experienced specialists',
    statSpecialists: 'Specialist doctors', statServices: 'Service lines', statHours: 'Daily hours', statEquip: 'Modern equipment',
    whyEyebrow: 'Why choose us',
    whyDesc: 'We give every patient attention and an accurate diagnosis — your health is our priority.',
    why: [
      'Experienced and qualified doctors',
      'Modern diagnostic equipment (ultrasound, lab)',
      'Open daily, minimal waiting time',
      'Accurate results, delivered fast',
    ],
    contactNow: 'Get in touch',
    address: 'Address', hours: 'Working hours', phone: 'Phone',
    rights: 'All rights reserved.',
    services: [
      'Ultrasound (UZI)', 'Laboratory', 'Physiotherapy', 'Massage', 'Injections',
      'Neurology', 'Ozone therapy', 'Endocrinology', 'Phototherapy',
    ],
  },
}

function useLang() {
  const [lang, setLang] = useState(() => localStorage.getItem('landing-lang') || 'uz')
  const changeLang = (code) => {
    setLang(code)
    try { localStorage.setItem('landing-lang', code) } catch { /* noop */ }
  }
  return [lang, changeLang]
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [lang, setLang] = useLang()
  const { isLight } = useTheme()
  const { toggleTheme } = useAuthStore()
  const t = T[lang]

  const services = t.services.map((name, i) => ({ name, ...SERVICE_ICONS[i] }))
  const stats = [
    { value: '9', label: t.statSpecialists },
    { value: '9+', label: t.statServices },
    { value: '08–18', label: t.statHours },
    { value: '100%', label: t.statEquip },
  ]
  const quickLinks = [
    { Icon: CalendarCheck, label: t.quickBook, desc: t.quickBookDesc, href: '#contact' },
    { Icon: Stethoscope, label: t.quickServices, desc: t.quickServicesDesc, href: '#services' },
    { Icon: MapPin, label: t.quickAddress, desc: BRAND.address, href: '#contact' },
    { Icon: Clock, label: t.quickHours, desc: `${t.daily} ${BRAND.workHours}`, href: '#contact' },
  ]

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
            <img src={logo} alt={BRAND.name} className="h-8 w-8 shrink-0 rounded-xl object-cover sm:h-10 sm:w-10" />
            <span className="truncate text-sm font-black tracking-tight text-blue-950 dark:text-white sm:text-base">{BRAND.nameShort}</span>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 dark:text-slate-300 lg:flex">
            <a href="#services" className="transition-colors hover:text-teal-600 dark:hover:text-teal-400">{t.navServices}</a>
            <a href="#why" className="transition-colors hover:text-teal-600 dark:hover:text-teal-400">{t.navWhy}</a>
            <a href="#contact" className="transition-colors hover:text-teal-600 dark:hover:text-teal-400">{t.navContact}</a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href={`tel:${BRAND.phoneRaw}`}
              className="hidden items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-teal-200 transition-transform hover:scale-105 sm:flex"
            >
              <Phone className="h-4 w-4" />
              {t.call}
            </a>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Fon"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Language switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangMenuOpen((v) => !v)}
                className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-black uppercase text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {lang}
              </button>
              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLangMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => { setLang(l.code); setLangMenuOpen(false) }}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-sm font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${lang === l.code ? 'text-teal-600' : 'text-slate-700 dark:text-slate-200'}`}
                      >
                        {l.label}
                        <span className="text-[10px] font-black uppercase text-slate-400">{l.code}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Hamburger — Profile / staff login */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menyu"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <User className="h-4 w-4 text-teal-600" />
                      {t.profile}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2">
          <div className="relative text-center lg:text-left">
            <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              {t.eyebrow}
            </span>
            <h1 className="mt-4 text-4xl font-black leading-[1.1] text-blue-950 dark:text-white sm:text-5xl">
              {t.heroTitle1}<br />
              <span className="text-teal-600 dark:text-teal-400">{t.heroTitle2}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-base text-slate-500 dark:text-slate-400 sm:text-lg lg:mx-0">
              {t.heroDesc}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <a
                href={`tel:${BRAND.phoneRaw}`}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-200 transition-transform hover:scale-105 dark:shadow-none"
              >
                <Phone className="h-4 w-4" />
                {BRAND.phone}
              </a>
              <a
                href="#services"
                className="flex items-center gap-1.5 rounded-xl border-2 border-blue-950 px-6 py-3.5 text-sm font-bold text-blue-950 transition-colors hover:bg-blue-950 hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-blue-950"
              >
                {t.seeServices}
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-teal-100 blur-3xl dark:bg-teal-900/30" />
            <img
              src={heroImage}
              alt={`${BRAND.name} — UZI diagnostika xonasi`}
              className="w-full rounded-3xl border border-slate-100 object-cover shadow-2xl dark:border-slate-800"
            />
            <div className="absolute -left-4 top-6 hidden items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-xl sm:flex dark:bg-slate-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                <ShieldCheck className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-950 dark:text-white">{t.licensed}</p>
                <p className="text-[11px] text-slate-400">{t.clinic}</p>
              </div>
            </div>
            <div className="absolute -right-4 bottom-6 hidden items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-xl sm:flex dark:bg-slate-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950">
                <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-950 dark:text-white">{t.daily}</p>
                <p className="text-[11px] text-slate-400">{BRAND.workHours}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick links bar */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:grid-cols-4">
          {quickLinks.map(({ Icon, label, desc, href }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                <Icon className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-blue-950 dark:text-white">{label}</p>
                <p className="truncate text-xs text-slate-400">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-10 text-center">
          <span className="text-xs font-black uppercase tracking-wide text-teal-600 dark:text-teal-400">{t.servicesEyebrow}</span>
          <h2 className="mt-2 text-3xl font-black text-blue-950 dark:text-white">
            {t.servicesTitle1} <span className="text-teal-600 dark:text-teal-400">{t.servicesTitle2}</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-500 dark:text-slate-400">
            {t.servicesDesc}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {services.map(({ name, Icon, color }) => (
            <div
              key={name}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                style={{ background: `${color}18` }}
              >
                <Icon className="h-7 w-7" style={{ color }} />
              </div>
              <span className="text-sm font-bold text-blue-950 dark:text-white">{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-gradient-to-r from-blue-950 via-blue-900 to-teal-800 py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center text-white">
              <p className="text-2xl font-black sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs font-semibold text-blue-200">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section id="why" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <img
              src={whyImage}
              alt={t.whyEyebrow}
              className="aspect-[4/3] w-full rounded-3xl border border-slate-100 object-cover shadow-xl dark:border-slate-800"
            />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wide text-teal-600 dark:text-teal-400">{t.whyEyebrow}</span>
            <h2 className="mt-2 text-3xl font-black text-blue-950 dark:text-white">{BRAND.name}</h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {t.whyDesc}
            </p>
            <div className="mt-6 space-y-3">
              {t.why.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item}</span>
                </div>
              ))}
            </div>
            <a
              href={`tel:${BRAND.phoneRaw}`}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-950 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 dark:bg-teal-600"
            >
              <Phone className="h-4 w-4" />
              {t.contactNow}
            </a>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section id="contact" className="mx-auto max-w-6xl px-4 pb-20">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-teal-600 to-blue-800 p-8 shadow-xl sm:p-12">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-teal-100">{t.address}</p>
                <p className="font-bold">{BRAND.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-teal-100">{t.hours}</p>
                <p className="font-bold">{t.daily} {BRAND.workHours}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-white">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-teal-100">{t.phone}</p>
                <a href={`tel:${BRAND.phoneRaw}`} className="font-bold hover:underline">{BRAND.phone}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt={BRAND.name} className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-sm font-black text-blue-950 dark:text-white">{BRAND.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              {BRAND.instagram && (
                <a href={BRAND.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-teal-600">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
              )}
              {BRAND.telegram && (
                <a href={BRAND.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-teal-600">
                  <Send className="h-4 w-4" />
                  Telegram
                </a>
              )}
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} {BRAND.name}. {t.rights}
          </p>
          <p className="mt-1 text-center text-[10px] text-slate-300 dark:text-slate-600">
            Photo: <a href="https://commons.wikimedia.org/wiki/User:Shixart1985" target="_blank" rel="noopener noreferrer" className="underline">Shixart1985</a> (CC BY 2.0)
          </p>
        </div>
      </footer>
    </div>
  )
}
