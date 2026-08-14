// Laboratoriya va UZI shablonlari — shablonlar/Lab va shablonlar/Uzi papkalaridagi
// asl Word fayllarining HTML'ga o'girilgan, original formatlashi (qalin sarlavhalar,
// kursiv) saqlangan matni asosida. "______" belgisi — shifokor to'ldirishi kerak
// bo'lgan joy; frontend bu belgilarni interaktiv katakchalarga almashtiradi.
// Qolgan matn (formatlash bilan birga) qulflangan — tahrirlab bo'lmaydi.

const CLINIC_HEADER_HTML =
  '<p style="text-align:center;margin:0 0 2px;"><strong style="font-size:15px;">MARJONA MED SERVIS</strong></p>' +
  '<p style="text-align:center;margin:0 0 2px;font-size:11px;"><strong>Hazorasp tumani, Hazorasp shaxarchasi, Ibn Sino ko\'chasi</strong></p>' +
  '<p style="text-align:center;margin:0 0 10px;font-size:11px;"><strong>Tel: +998-88-130-44-24, +998-97-512-84-63</strong></p>' +
  '<hr style="margin:0 0 10px;border-color:#999;" />'

function withHeader(patientLine, body) {
  return CLINIC_HEADER_HTML + `<p><strong>${patientLine}</strong></p>` + body
}

const PATIENT_LINE = 'Ф.И.О: ______   Дата: ______'

export const REPORT_TEMPLATES = [
  // ───────────────────────── LABORATORIYA ─────────────────────────
  {
    key: 'LAB_OAK',
    category: 'Laboratoriya',
    name: "Umumiy Qon Tahlili (OAK)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ОБЩИЙ АНАЛИЗ КРОВИ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Гемоглобин (HGB)</td><td>______</td><td>Эркак 130-160, Аёл 120-150 г/л</td></tr>' +
      '<tr><td>Эритроцитлар (RBC)</td><td>______</td><td>3.8-5.5 x10^12/л</td></tr>' +
      '<tr><td>Гематокрит (HCT)</td><td>______</td><td>37-49 %</td></tr>' +
      '<tr><td>Эритроцит уртача хажми (MCV)</td><td>______</td><td>80-100 fl</td></tr>' +
      '<tr><td>Уртача Гемоглобин микдори (MCH)</td><td>______</td><td>27-31 pg</td></tr>' +
      '<tr><td>Гемоглобиннинг уртача концентрацияси (MCHC)</td><td>______</td><td>320-360 г/л</td></tr>' +
      '<tr><td>Эритроцитлар анизоцитози (RDW-CV)</td><td>______</td><td>11-15 %</td></tr>' +
      '<tr><td>Тромбоцитлар сони (PLT)</td><td>______</td><td>150-400 x10^9/л</td></tr>' +
      '<tr><td>Тромбоцит уртача хажми (MPV)</td><td>______</td><td>7-11 fl</td></tr>' +
      '<tr><td>Тромбокрит (PCT)</td><td>______</td><td>0.1-0.5 %</td></tr>' +
      '<tr><td>Лейкоцитлар (WBC)</td><td>______</td><td>4.0-9.0 x10^9/л</td></tr>' +
      '<tr><td>Лимфоцитлар (Lymph%)</td><td>______</td><td>20-40 %</td></tr>' +
      '<tr><td>Моноцитлар (Mid%)</td><td>______</td><td>3-9 %</td></tr>' +
      '<tr><td>Гранулоцитлар (Gran%)</td><td>______</td><td>50-70 %</td></tr>' +
      '<tr><td>СОЭ</td><td>______</td><td>Эркак 1-10, Аёл 2-15 мм/соат</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_OAM',
    category: 'Laboratoriya',
    name: "Umumiy Peshob Tahlili (OAM)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ОБЩИЙ АНАЛИЗ МОЧИ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Цвет мочи</td><td>______</td><td>Соломенно-желтая</td></tr>' +
      '<tr><td>Удельный вес (SG)</td><td>______</td><td>1015-1025</td></tr>' +
      '<tr><td>Лейкоцит (LEU)</td><td>______</td><td>До 3 (эрк.) / До 6 (аёл) п.з.</td></tr>' +
      '<tr><td>Нитрит (NIT)</td><td>______</td><td>Abs</td></tr>' +
      '<tr><td>Урабилиноген (URO)</td><td>______</td><td>Норма</td></tr>' +
      '<tr><td>Кетоновое тело (KET)</td><td>______</td><td>Abs</td></tr>' +
      '<tr><td>Глюкоза (GUL)</td><td>______</td><td>Abs</td></tr>' +
      '<tr><td>Ацетон</td><td>______</td><td>Нерезкий</td></tr>' +
      '<tr><td>Количество мочи</td><td>______</td><td>50-100 г</td></tr>' +
      '<tr><td>Соли моча</td><td>______</td><td>Abs</td></tr>' +
      '<tr><td>Зернистые цилиндры</td><td>______</td><td>Abs</td></tr>' +
      '<tr><td>Почечные клетка</td><td>______</td><td>Abs</td></tr>' +
      '<tr><td>Слизь</td><td>______</td><td>Abs</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_BIOXIM',
    category: 'Laboratoriya',
    name: "Biokimyoviy Qon Tahlili",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>БИОХИМИЧЕСКОЕ ИССЛЕДОВАНИЕ КРОВИ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>АЛТ</td><td>______</td><td>0-40 U/l</td></tr>' +
      '<tr><td>АСТ</td><td>______</td><td>0-40 U/l</td></tr>' +
      '<tr><td>Билирубин общий</td><td>______</td><td>8.5-20.5 мкмоль/л</td></tr>' +
      '<tr><td>Общий белок (PRO)</td><td>______</td><td>66-87 г/л</td></tr>' +
      '<tr><td>Альбумин</td><td>______</td><td>40-50 г/л</td></tr>' +
      '<tr><td>Диастаза (Альфа-амилаза)</td><td>______</td><td>—</td></tr>' +
      '<tr><td>Мочевая кислота</td><td>______</td><td>140-420 мкмоль/л</td></tr>' +
      '<tr><td>Мочевина</td><td>______</td><td>2.5-8.3 ммоль/л</td></tr>' +
      '<tr><td>Креатинин</td><td>______</td><td>44-106 мкмоль/л</td></tr>' +
      '<tr><td>Глюкоза</td><td>______</td><td>3.3-5.5 ммоль/л</td></tr>' +
      '<tr><td>Гамма-глутаминтрансфераза</td><td>______</td><td>—</td></tr>' +
      '<tr><td>Щелочная фосфатаза (ALP)</td><td>______</td><td>—</td></tr>' +
      '<tr><td>Холестерин (CHOL)</td><td>______</td><td>3.0-5.2 ммоль/л</td></tr>' +
      '<tr><td>Триглицериды (TG)</td><td>______</td><td>0.4-1.7 ммоль/л</td></tr>' +
      '<tr><td>Магний</td><td>______</td><td>0.7-1.1 ммоль/л</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_NECHIPORENKO',
    category: 'Laboratoriya',
    name: "Peshob (Nechiporenko usulida)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>МОЧА ПО НЕЧИПОРЕНКО</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Лейкоцит</td><td>______</td><td>Эркак: 2000 гача (1мл да)</td></tr>' +
      '<tr><td>Эритроцит</td><td>______</td><td>1000 гача (1мл да)</td></tr>' +
      '<tr><td>Цилиндр</td><td>______</td><td>20 гача (1мл да)</td></tr>' +
      '<tr><td>PH</td><td>______</td><td>5.0-7.0</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_ANALYZ_ALLERGY',
    category: 'Laboratoriya',
    name: "Qon Tahlili — Allergiya (IgG)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>АНАЛИЗ КРОВИ НА АЛЛЕРГИЯ IgG</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Иммуноглобулин IgG</td><td>______</td><td>10-15 ёш: 120 МЕ/мл, 15+ ёш: 130 МЕ/мл</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_VICH',
    category: 'Laboratoriya',
    name: "VICH (Immunoferment Tahlili)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ИММУНОФЕРМЕНТ ТАХЛИЛИ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>ВИЧ (ИФА)</td><td>______</td><td>Отрицательно</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_VITAMIN_D',
    category: 'Laboratoriya',
    name: "Vitamin D (25-OH, IFA)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ВИТАМИН Д (ИФА)</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Izoh</strong></td></tr>' +
      '<tr><td>25-OH Витамин D</td><td>______ нг/мл</td><td>30-50 норма; &lt;20 етишмовчилик; &gt;70 ортиқча</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_GEPATIT',
    category: 'Laboratoriya',
    name: "Gepatit (Ekspress test)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ГЕПАТИТ (экспресс тест)</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>HBs Ag (Гепатит B)</td><td>______</td><td>Отрицательно</td></tr>' +
      '<tr><td>Anti-HCV (Гепатит C)</td><td>______</td><td>Отрицательно</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_GORMON',
    category: 'Laboratoriya',
    name: "Gormonal Tahlil (FSG/LG/Prolaktin/Testosteron/Progesteron/Estradiol)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>АНАЛИЗ КРОВИ НА ГОРМОН</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>ФСГ</td><td>______</td><td>Жинс/фазага қараб</td></tr>' +
      '<tr><td>ЛГ</td><td>______</td><td>Жинс/фазага қараб</td></tr>' +
      '<tr><td>Пролактин</td><td>______</td><td>Эркак: 60-560 mIU/l</td></tr>' +
      '<tr><td>Тестостерон</td><td>______</td><td>Ёшга қараб</td></tr>' +
      '<tr><td>Прогестерон</td><td>______</td><td>Фазага қараб</td></tr>' +
      '<tr><td>Эстрадиол</td><td>______</td><td>ФФ 30-120, ЛФ 70-250 нг/мл</td></tr>' +
      '</table><p><strong>Врач лабарант:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_MAZOK',
    category: 'Laboratoriya',
    name: "Mazok (Umumiy Flora Tahlili)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>УМУМИЙ ФЛОРА ТАХЛИЛИ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td></tr>' +
      '<tr><td>Умумий флора тахлили</td><td>______</td></tr>' +
      '<tr><td>Лейкоцитлар</td><td>______</td></tr>' +
      '<tr><td>Эпителий</td><td>______</td></tr>' +
      '<tr><td>Бошка флора</td><td>______</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_PARAZIT',
    category: 'Laboratoriya',
    name: "Parazitologik Tahlil",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>АНАЛИЗ ПАРАЗИТ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Лямблии суммарные</td><td>______</td><td>Отр.</td></tr>' +
      '<tr><td>Тенида (Тасма)</td><td>______</td><td>Отр.</td></tr>' +
      '<tr><td>Аскарида IgG</td><td>______</td><td>Отр.</td></tr>' +
      '<tr><td>Эхинококк IgG</td><td>______</td><td>Отр.</td></tr>' +
      '<tr><td>Пакана гижжа</td><td>______</td><td>Отр.</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_REVMOPROBA',
    category: 'Laboratoriya',
    name: "Revmoproba (SRB/RF/ASLO)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>АНАЛИЗ КРОВИ НА РЕВМОПРОБА</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>С-реактивный белок</td><td>______</td><td>Отрицательно</td></tr>' +
      '<tr><td>РФ (Ревмотоидный фактор)</td><td>______</td><td>Отрицательно</td></tr>' +
      '<tr><td>АСЛО</td><td>______</td><td>Отрицательно</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_SPERMOGRAMMA',
    category: 'Laboratoriya',
    name: "Spermogramma (JSST 2010)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>СПЕРМОГРАММА ПО ВОЗ 2010</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Ранги</td><td>______</td><td>Оч-сут ранг</td></tr>' +
      '<tr><td>Ҳиди</td><td>______</td><td>Специфик</td></tr>' +
      '<tr><td>Кўриниши</td><td>______</td><td>Норма</td></tr>' +
      '<tr><td>Консистенцияси</td><td>______</td><td>Ёпишқоқ</td></tr>' +
      '<tr><td>Суюлиш вакти</td><td>______</td><td>20-60 мин</td></tr>' +
      '<tr><td>Сони (1мл да)</td><td>______</td><td>15 млндан кўп</td></tr>' +
      '<tr><td>Эякулятдаги сони</td><td>______</td><td>39 млндан кўп</td></tr>' +
      '<tr><td>Харакатчанлик</td><td>______</td><td>40% дан кўп</td></tr>' +
      '<tr><td>Прогрессив харакатчанлик</td><td>______</td><td>32% дан кўп</td></tr>' +
      '<tr><td>Харакатсиз</td><td>______</td><td>14% дан кам</td></tr>' +
      '<tr><td>Нормал спермийлар</td><td>______</td><td>4% дан кўп</td></tr>' +
      '<tr><td>Анормал спермийлар</td><td>______</td><td>96% дан кам</td></tr>' +
      '<tr><td>Агглютинация</td><td>______</td><td>Йўк</td></tr>' +
      '<tr><td>Лейкоцитлар</td><td>______</td><td>1 млн/мл дан кам</td></tr>' +
      '<tr><td>Эритроцитлар</td><td>______</td><td>Йўк</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_TTG',
    category: 'Laboratoriya',
    name: "Qalqonsimon bez gormonlari (TTG/T3/T4/HGCH)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>АНАЛИЗ КРОВИ НА ГАРМОНЫ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Трийодтиронин Общий (Т3)</td><td>______</td><td>—</td></tr>' +
      '<tr><td>Трийодтиронин Свободный</td><td>______</td><td>—</td></tr>' +
      '<tr><td>Тироксин Общий (Т4)</td><td>______</td><td>—</td></tr>' +
      '<tr><td>Тироксин Свободный</td><td>______</td><td>—</td></tr>' +
      '<tr><td>ТТГ</td><td>______</td><td>0.4-4.0 mIU/l</td></tr>' +
      '<tr><td>Антитела к тиреопероксидазе</td><td>______</td><td>—</td></tr>' +
      '<tr><td>ХГЧ</td><td>______</td><td>Хафтасига қараб</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_ELEMENTLAR',
    category: 'Laboratoriya',
    name: "Elektrolitlar (Mikroelementlar)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>АНАЛИЗ КРОВИ НА ЭЛЕКТРОЛИТЫ</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Натрий</td><td>______</td><td>135-150 ммоль/л</td></tr>' +
      '<tr><td>Калий</td><td>______</td><td>3.5-5.1 ммоль/л</td></tr>' +
      '<tr><td>Хлор</td><td>______</td><td>98-107 ммоль/л</td></tr>' +
      '<tr><td>Кальций</td><td>______</td><td>2.15-2.55 ммоль/л</td></tr>' +
      '<tr><td>Железо</td><td>______</td><td>Жинсга қараб</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'LAB_RW',
    category: 'Laboratoriya',
    name: "Vasserman Reaksiyasi (RW)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>РЕАКЦИЯ ВАССЕРМАНА (RW)</em></strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td><strong>Ko\'rsatkich</strong></td><td><strong>Natija</strong></td><td><strong>Norma</strong></td></tr>' +
      '<tr><td>Реакция Вассермана (RW)</td><td>______</td><td>Отрицательно</td></tr>' +
      '</table><p><strong>Лабарант Врач:</strong> ______</p>'
    ),
  },

  // ───────────────────────────── UZI ─────────────────────────────
  {
    key: 'UZI_BUYRAK',
    category: 'UZI',
    name: 'Buyraklar UZI',
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ПРОТОКОЛ УЛЬТРАЗВУКОВОГО ИССЛЕДОВАНИЯ ПОЧЕК</em></strong></p>' +
      '<p><strong><em>Мочевой пузырь</em></strong> не деформирована, обычной формы. Объем ______мл. Стенки не деформированы. Толщина ______мм. Содержимое однородное.</p>' +
      '<p><strong><em>Правая почка</em></strong> - ______мм. Топография не изменена. Дыхательная подвижность сохранена. Капсула прослеживается на всем протяжении, толщиной - ______мм, гиперэхогенная. Толщина почечной паренхимы ______мм. Паренхима повышенной эхогенности. ЧЛС - не расширена.</p>' +
      '<p><strong><em>Левая почка</em></strong> - ______мм. Топография не изменена. Дыхательная подвижность сохранена. Капсула прослеживается на всем протяжении, толщиной - ______мм, гиперэхогенная. Толщина почечной паренхимы ______мм. Паренхима однородная. ЧЛС - не расширена.</p>' +
      '<p><strong><em>Предстательная железа</em></strong> - размеры ______мм. Контуры ровные четкие. Эхоструктура однородная. Эхогенность - гипоэхогенная.</p>' +
      '<p><strong><em>Остаточная моча:</em></strong> ______мл</p>' +
      '<p><strong>Заключение:</strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'UZI_BACHADON',
    category: 'UZI',
    name: "Bachadon va qo'shimchalar UZI (Ginekologik)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ПРОТОКОЛ УЛЬТРОЗВУКОВОГО ИССЛЕДОВАНИЯ МАТКА С ПРИДАТКАМИ</em></strong></p>' +
      '<p><strong><em>Мочевой пузырь</em></strong> не деформирована, обычной формы. Объем ______мл. Стенки не деформированы. Толщина ______мм. Содержимое однородное.</p>' +
      '<p><strong><em>Матка</em></strong> - позиция: AFV не увеличена, длина ______мм, переднезадний размер ______мм, ширина ______мм. Топография не изменена. Контур ровные. Толщина миометрия – ______мм. Структура однородня.</p>' +
      '<p>Тощина эндометрия - ______мм. Структура однородная. Полость расширена. <strong><em>Шейка матки:</em></strong> ______мм. Контур ровные. Структура стенок однородная. Цервикальный канал не расширен, не деформирован. Эндоцервикс не утолщен.</p>' +
      '<p><strong><em>Правый яичник:</em></strong> размеры ______мм, структура однородная.</p>' +
      '<p><strong><em>Левый яичник:</em></strong> размеры ______мм, структура однородная, <strong><em>фолликула</em></strong> д-______мм. Маточные трубы не расширена.</p>' +
      '<p><strong><em>Дугласово пространство</em></strong> - свободная жидкость не визуализируется.</p>' +
      '<p><strong>Заключение:</strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'UZI_JIGAR',
    category: 'UZI',
    name: "Jigar UZI (Qorin bo'shlig'i — jigar diagnostikasi)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ПРОТОКОЛ УЛЬТРОЗВУКОВОГО ИССЛЕДОВАНИЯ БРЮШНОЙ ПОЛОСТИ</em></strong></p>' +
      '<p><strong><em>Печень</em></strong> не увеличена, подвижная. КВР правой доли - ______мм, ККР левой доли - ______мм. Контуры ровные, четкие. Капсула прослеживается на всем протяжении, ровная, толщина - ______мм. Паренхима повышенной эхогенности. Эхоструктура однородная. Внутрипеченочные желчные ходы не расширены. Портальной вены - ______мм, I.V.C. - ______мм.</p>' +
      '<p><strong><em>Желчный пузырь</em></strong> – размерами ______мм, контуры ровные, четкие. Стенки не деформированы, толщиной - ______мм. Содержимое не однородное густое. Холедох - ______мм.</p>' +
      '<p><strong><em>Поджелудочная железа</em></strong> не увеличена. Контуры ровные. Толщина головки - ______мм, тела - ______мм, хвоста - ______мм. Паренхима повышенной эхогенности. Эхоструктура однородная. Вирсунгов проток не расширен.</p>' +
      '<p><strong><em>Селезенка</em></strong> не увеличена, подвижная. Размеры - ______мм. Контуры ровные. Капсула прослеживается на всем протяжении. Паренхима однородная.</p>' +
      '<p><strong>Заключение:</strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'UZI_QORIN_UMUMIY',
    category: 'UZI',
    name: "Qorin bo'shlig'i UZI (Umumiy, kattalar)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ПРОТОКОЛ УЛЬТРОЗВУКОВОГО ИССЛЕДОВАНИЯ БРЮШНОЙ ПОЛОСТИ</em></strong></p>' +
      '<p><strong><em>Печень</em></strong> не увеличена, подвижная. КВР правой доли - ______мм, ККР левой доли - ______мм. Контуры ровные, четкие. Толщина - ______мм. Паренхима повышенной эхогенности. Портальной вены - ______мм, I.V.C. - ______мм.</p>' +
      '<p><strong><em>Желчный пузырь</em></strong> - размерами ______мм. Стенки толщиной - ______мм. Холедох - ______мм.</p>' +
      '<p><strong><em>Поджелудочная железа</em></strong> - головка ______мм, тело ______мм, хвост ______мм.</p>' +
      '<p><strong><em>Селезенка</em></strong> - размеры ______мм.</p>' +
      '<p><strong><em>Правая почка</em></strong> - ______мм, паренхима ______мм. <strong><em>Левая почка</em></strong> - ______мм, паренхима ______мм. ЧЛС - не расширена.</p>' +
      '<p><strong><em>Мочевой пузырь</em></strong> - объем ______мл, толщина стенки ______мм.</p>' +
      '<p><strong><em>Предстательная железа</em></strong> - размеры ______мм. Эхоструктура не однородная. <strong><em>Остаточная моча:</em></strong> ______мл.</p>' +
      '<p><strong>Заключение:</strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'UZI_QORIN_BOLALAR',
    category: 'UZI',
    name: "Qorin bo'shlig'i UZI (Bolalar)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ПРОТОКОЛ УЛЬТРАЗВУКОВОГО ИССЛЕДОВАНИЯ БРЮШНОЙ ПОЛОСТИ</em></strong></p>' +
      '<p><strong><em>Печень</em></strong> не увеличена, подвижная. КВР правой доли ______мм. Толщина - ______мм. Паренхима средней эхогенности. Портальной вены - ______мм, I.V.C. - ______мм.</p>' +
      '<p><strong><em>Желчный</em></strong> - размерами ______мм, толщиной - ______мм.</p>' +
      '<p><strong><em>Поджелудочная железа</em></strong> - головка ______мм, тело ______мм, хвост ______мм.</p>' +
      '<p><strong><em>Селезенка</em></strong> - размеры ______мм.</p>' +
      '<p><strong><em>Правая почка</em></strong> – ______мм, паренхима ______мм. <strong><em>Левая почка</em></strong> – ______мм, паренхима ______мм.</p>' +
      '<p><strong><em>Мочевой пузырь</em></strong> - объем ______мл, толщина ______мм. Содержимое гомогенное.</p>' +
      '<p><strong>Заключение:</strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'UZI_ZOB',
    category: 'UZI',
    name: "Qalqonsimon bez (Zob) UZI",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong>ПЕРЕШЕЕК</strong></p>' +
      '<p><strong>Топография:</strong> на обычном месте <strong>Контур:</strong> ______ <strong>Эластичность:</strong> ______</p>' +
      '<p><strong>Размер толщина:</strong> ______мм (норма 4-6 мм) <strong>Эхоструктура:</strong> ______ <strong>Эхогенность:</strong> ______</p>' +
      '<p><strong>ПРАВАЯ ДОЛЯ</strong></p>' +
      '<p><strong>Контур:</strong> ______ <strong>Эластичность:</strong> ______</p>' +
      '<p><strong>Размер:</strong> длина ______мм, толщина ______мм, ширина ______мм. <strong>Форма:</strong> ______ <strong>Эхоструктура:</strong> ______ <strong>Эхогенность:</strong> ______</p>' +
      '<p><strong>ЛЕВАЯ ДОЛЯ</strong></p>' +
      '<p><strong>Контур:</strong> ______ <strong>Эластичность:</strong> ______</p>' +
      '<p><strong>Размер:</strong> длина ______мм, толщина ______мм, ширина ______мм. <strong>Форма:</strong> ______ <strong>Эхоструктура:</strong> ______ <strong>Эхогенность:</strong> ______</p>' +
      '<p><strong>Вывод:</strong> ______</p>' +
      '<p><strong>Рекомендовано:</strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'UZI_TOMIRLAR',
    category: 'UZI',
    name: "Qon-tomirlari UZI (Oyoq arteriya-vena, Doppler)",
    bodyHtml: withHeader(PATIENT_LINE,
      '<p><strong><em>ОЁК АРТЕРИЯЛАРИ ва ВЕНАЛАРИ УЛЬТРАТОВУШ ТЕКШИРУВИ</em></strong></p>' +
      '<p><strong><em>Артериялар.</em></strong> Утказувчанлиги ______. Кон окими спектри ______. Интима медиа комплекси ______мм. Атеросклеротик пиликчалар: ______. Стеноз ва окклюзиялар: ______.</p>' +
      '<p><strong><em>Веналар.</em></strong> Утказувчанлиги ______. Девори ______. Клапан функцияси ______, патологик рефлюкслар: ______. Катта тери ости венаси: ______.</p>' +
      '<p><strong><em>Хулоса:</em></strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>' +
      '<p><em>Хулоса диагноз хисобланмайди, даволовчи врач маслахати ва бошка клиник лаборатор текширувлар лозим!</em></p>'
    ),
  },
  {
    key: 'UZI_NEYROSONOGRAFIYA',
    category: 'UZI',
    name: 'Neyrosonografiya (Bosh miya, chaqaloq)',
    bodyHtml: withHeader('Ф.И.О: ______   Ёши: ______   Дата: ______',
      '<p><strong>НЕЙРОСОНОГРАФИЯ</strong></p>' +
      '<p><strong><em>Рисунок извилин и борозд:</em></strong> ______</p>' +
      '<p><strong><em>Поясная борозда:</em></strong> ______мм <strong><em>Субарахноидальная пространство</em></strong> справа ______мм, слева ______мм (до 3мм)</p>' +
      '<p><strong><em>Межполушарная щель:</em></strong> ______мм <strong><em>Верхний сагиттальный синус:</em></strong> ______мм</p>' +
      '<p><strong>Боковые желудочки:</strong></p>' +
      '<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:12px;">' +
      '<tr><td></td><td><strong>Справа</strong></td><td><strong>Слева</strong></td></tr>' +
      '<tr><td>Глубина на уровне тел</td><td>______мм</td><td>______мм</td></tr>' +
      '<tr><td>Глубина на уровне передних рогов</td><td>______мм</td><td>______мм</td></tr>' +
      '<tr><td>Затылочные рога</td><td>______мм</td><td>______мм</td></tr>' +
      '<tr><td>Височные рога</td><td>______мм</td><td>______мм</td></tr>' +
      '</table>' +
      '<p><strong><em>Ширина III желудочка:</em></strong> ______мм <strong><em>Глубина IV желудочка:</em></strong> ______мм <strong><em>Большая цистерна:</em></strong> ______мм</p>' +
      '<p><strong>Сосудистые сплетения:</strong> справа ______мм, слева ______мм</p>' +
      '<p><strong>Перивентрикулярная область.</strong> Эхогенность: ______ Эхоструктура: ______</p>' +
      '<p><strong>Таламус и подкорковые ядра.</strong> Эхогенность: ______ <strong>Мозжечок.</strong> Эхогенность: ______</p>' +
      '<p><strong>Допплерометрия:</strong> ПМА RI ______, ВБ RI ______, СМА RI ______ (норма 0,60-0,70)</p>' +
      '<p><strong>Скорость кровотока в вене Галена:</strong> ______см/сек <strong>ЧСС:</strong> ______ уд/мин</p>' +
      '<p><strong>Заключение:</strong> ______</p>' +
      '<p><strong>Врач:</strong> ______</p>'
    ),
  },
  {
    key: 'UZI_MOYAK',
    category: 'UZI',
    name: 'Moyaklar UZI (Skrotal)',
    bodyHtml: withHeader('Bemorni F.I.Sh: ______   Tekshiruv sanasi: ______',
      '<p><strong>O\'NG MOYAK.</strong></p>' +
      '<p><strong>Joylashishi</strong> ko\'ruv vaqtida normada yorg\'oq bo\'shlig\'ida. <strong>Chetlari</strong> ______. <strong>Qapsulasi</strong> ______.</p>' +
      '<p><strong>O\'lchami:</strong> uzunligi ______mm, kengligi ______mm, qalinligi ______mm. <strong>Xajmi</strong> ______sm3</p>' +
      '<p><strong>Exogenligi</strong> ______. Rangli Dopplerda qon oqimi ______. <strong>Exostrukturasi</strong> ______.</p>' +
      '<p><strong>Urug\' tizimchasi venalari</strong> ______mm kengaygan. Valsalva sinamasida: ______. Erkin suyuqlik: ______ml</p>' +
      '<p><strong>O\'NG MOYAK ORTIG\'I.</strong> O\'lchami ______mm. Chetlari ______. Exostrukturasi ______.</p>' +
      '<p><strong>CHAP MOYAK.</strong></p>' +
      '<p><strong>Joylashishi</strong> ko\'ruv vaqtida normada yorg\'oq bo\'shlig\'ida. <strong>Chetlari</strong> ______. <strong>Qapsulasi</strong> ______.</p>' +
      '<p><strong>O\'lchami:</strong> uzunligi ______mm, kengligi ______mm, qalinligi ______mm. <strong>Xajmi</strong> ______sm3</p>' +
      '<p><strong>Exogenligi</strong> ______. Rangli Dopplerda qon oqimi ______. <strong>Exostrukturasi</strong> ______.</p>' +
      '<p><strong>Urug\' tizimchasi venalari</strong> ______mm kengaygan. Valsalva sinamasida: ______. Erkin suyuqlik: ______ml</p>' +
      '<p><strong>CHAP MOYAK ORTIG\'I.</strong> O\'lchami ______mm. Chetlari ______. Exostrukturasi ______.</p>' +
      '<p><strong>Exografiya xulosasi:</strong> ______</p>' +
      '<p><strong>Shifokor:</strong> ______</p>' +
      '<p><em>Xulosa diagnoz hisoblanmaydi, davolovchi shifokor maslahati va boshqa klinik-laborator tekshiruvlar lozim!</em></p>'
    ),
  },
]

export function getTemplateByKey(key) {
  return REPORT_TEMPLATES.find((t) => t.key === key) || null
}

// Xizmat category/nomidan qaysi shablon guruhi tegishli ekanini taxmin qiladi.
export function guessTemplateCategory(serviceCategory, serviceName) {
  const combined = `${serviceCategory || ''} ${serviceName || ''}`.toLowerCase()
  if (combined.includes('uzi') || combined.includes('узи')) return 'UZI'
  if (
    combined.includes('laborat') || combined.includes('labar') ||
    combined.includes('tahlil') || combined.includes('analiz')
  ) return 'Laboratoriya'
  return null
}

export function getTemplatesByCategory(category) {
  if (!category) return REPORT_TEMPLATES
  return REPORT_TEMPLATES.filter((t) => t.category === category)
}
