// Laboratoriya va UZI shablonlari — shablonlar/Lab va shablonlar/Uzi papkalaridagi
// asl Word fayllari asosida tuzilgan. Har bir shablon `key` orqali Service.template_key
// bilan bog'lanadi (Xizmatlar Katalogida CEO/Admin tomonidan biriktiriladi).

export const REPORT_TEMPLATES = [
  // ───────────────────────── LABORATORIYA ─────────────────────────
  {
    key: 'LAB_OAK',
    category: 'Laboratoriya',
    name: "Umumiy Qon Tahlili (OAK)",
    fields: [
      { name: 'Gemoglobin (HGB)', norm: 'Erkak 130-160, Ayol 120-150 g/l', unit: 'g/l' },
      { name: 'Eritrotsitlar (RBC)', norm: '3.8-5.5 x10^12/l', unit: 'x10^12/l' },
      { name: 'Gematokrit (HCT)', norm: '37-49 %', unit: '%' },
      { name: 'Eritrotsit o\'rtacha hajmi (MCV)', norm: '80-100 fl', unit: 'fl' },
      { name: 'O\'rtacha gemoglobin miqdori (MCH)', norm: '27-31 pg', unit: 'pg' },
      { name: 'O\'rtacha gemoglobin konsentratsiyasi (MCHC)', norm: '320-360 g/l', unit: 'g/l' },
      { name: 'Eritrotsitlar anizotsitozi (RDW-CV)', norm: '11-15 %', unit: '%' },
      { name: 'Trombotsitlar soni (PLT)', norm: '150-400 x10^9/l', unit: 'x10^9/l' },
      { name: 'Trombotsit o\'rtacha hajmi (MPV)', norm: '7-11 fl', unit: 'fl' },
      { name: 'Trombokrit (PCT)', norm: '0.1-0.5 %', unit: '%' },
      { name: 'Leykotsitlar (WBC)', norm: '4.0-9.0 x10^9/l', unit: 'x10^9/l' },
      { name: 'Limfotsitlar (Lymph%)', norm: '20-40 %', unit: '%' },
      { name: 'Monotsitlar (Mid%)', norm: '3-9 %', unit: '%' },
      { name: 'Granulotsitlar (Gran%)', norm: '50-70 %', unit: '%' },
      { name: 'ChEQT / SOE', norm: 'Erkak 1-10, Ayol 2-15 mm/soat', unit: 'mm/soat' },
      { name: 'Qon ivishi (boshlanishi/tugashi)', norm: '', unit: '' },
    ],
  },
  {
    key: 'LAB_OAM',
    category: 'Laboratoriya',
    name: "Umumiy Peshob Tahlili (OAM)",
    fields: [
      { name: 'Rangi', norm: 'Somon-sariq', unit: '' },
      { name: 'Solishtirma og\'irlik (SG)', norm: '1015-1025', unit: '' },
      { name: 'Leykotsitlar (LEU)', norm: 'Ayol: 0-6, Erkak: 0-3 k.m', unit: 'k.m' },
      { name: 'Nitrit (NIT)', norm: 'Yo\'q (abs)', unit: '' },
      { name: 'Urobilinogen (URO)', norm: 'Norma', unit: '' },
      { name: 'Keton tanachalari (KET)', norm: 'Yo\'q (abs)', unit: '' },
      { name: 'Glyukoza (GUL)', norm: 'Yo\'q (abs)', unit: '' },
      { name: 'Oqsil (Protein)', norm: 'Topilmadi', unit: '' },
      { name: 'Atseton', norm: 'Yo\'q', unit: '' },
      { name: 'Miqdori', norm: '50-100 ml', unit: 'ml' },
      { name: 'Tuzlar', norm: 'Yo\'q', unit: '' },
      { name: 'Donador silindrlar', norm: 'Yo\'q', unit: '' },
      { name: 'Buyrak epiteliy hujayralari', norm: 'Yo\'q', unit: '' },
      { name: 'Shilliq', norm: 'Yo\'q', unit: '' },
    ],
  },
  {
    key: 'LAB_BIOXIM',
    category: 'Laboratoriya',
    name: "Biokimyoviy Qon Tahlili",
    fields: [
      { name: 'ALT (Alaninaminotransferaza)', norm: '0-40 U/l', unit: 'U/l' },
      { name: 'AST (Aspartataminotransferaza)', norm: '0-40 U/l', unit: 'U/l' },
      { name: 'Umumiy Bilirubin', norm: '8.5-20.5 mkmol/l', unit: 'mkmol/l' },
      { name: 'Umumiy oqsil (PRO)', norm: 'Kattalar: 66-87 g/l', unit: 'g/l' },
      { name: 'Albumin', norm: '40-50 g/l', unit: 'g/l' },
      { name: 'Diastaza (Alfa-amilaza)', norm: 'Norma bo\'yicha', unit: '' },
      { name: 'Siydik kislotasi', norm: '140-420 mkmol/l', unit: 'mkmol/l' },
      { name: 'Mochevina (Urea)', norm: '2.5-8.3 mmol/l', unit: 'mmol/l' },
      { name: 'Kreatinin', norm: '44-106 mkmol/l', unit: 'mkmol/l' },
      { name: 'Qondagi shakar (Glyukoza)', norm: '3.3-5.5 mmol/l', unit: 'mmol/l' },
      { name: 'Gamma-glutamintransferaza (GGT)', norm: 'Norma bo\'yicha', unit: '' },
      { name: 'Ishqoriy fosfataza (ALP)', norm: 'Norma bo\'yicha', unit: '' },
      { name: 'Xolesterin (CHOL)', norm: '3.0-5.2 mmol/l', unit: 'mmol/l' },
      { name: 'Triglitseridlar (TG)', norm: '0.4-1.7 mmol/l', unit: 'mmol/l' },
      { name: 'Magniy', norm: '0.7-1.1 mmol/l', unit: 'mmol/l' },
    ],
  },
  {
    key: 'LAB_NECHIPORENKO',
    category: 'Laboratoriya',
    name: "Peshob (Nechiporenko usulida)",
    fields: [
      { name: 'Leykotsitlar', norm: 'Erkak: 2000 gacha', unit: 'ml da' },
      { name: 'Eritrotsitlar', norm: '1000 gacha', unit: 'ml da' },
      { name: 'Silindrlar', norm: '20 gacha', unit: 'ml da' },
      { name: 'PH', norm: '5.0-7.0', unit: '' },
    ],
  },
  {
    key: 'LAB_ANALYZ_ALLERGY',
    category: 'Laboratoriya',
    name: "Qon Tahlili — Allergiya (IgG/IgE)",
    fields: [
      { name: 'Immunoglobulin IgG (umumiy)', norm: 'Yoshga qarab farqlanadi', unit: 'IU/ml' },
      { name: 'Allergen bo\'yicha izoh', norm: '', unit: '' },
    ],
  },
  {
    key: 'LAB_VICH',
    category: 'Laboratoriya',
    name: "VICH (Immunoferment Tahlili)",
    fields: [
      { name: 'VICH (IFA)', norm: 'Manfiy', unit: '' },
    ],
  },
  {
    key: 'LAB_VITAMIN_D',
    category: 'Laboratoriya',
    name: "Vitamin D (25-OH, IFA)",
    fields: [
      { name: '25-OH Vitamin D', norm: '30-50 ng/ml (norma)', unit: 'ng/ml' },
      { name: 'Izoh (yetishmovchilik darajasi)', norm: '<10 og\'ir, 10-20 yetarli emas, 20-30 past norma, 30-50 norma, 50-70 yuqori norma, 70-150 ortiqcha, >150 zaharlanish', unit: '' },
    ],
  },
  {
    key: 'LAB_GEPATIT',
    category: 'Laboratoriya',
    name: "Gepatit (Ekspress test)",
    fields: [
      { name: 'HBs Ag (Gepatit B)', norm: 'Manfiy', unit: '' },
      { name: 'Anti-HCV (Gepatit C)', norm: 'Manfiy', unit: '' },
    ],
  },
  {
    key: 'LAB_GORMON',
    category: 'Laboratoriya',
    name: "Gormonal Tahlil (FSG/LG/Prolaktin/Testosteron/Progesteron/Estradiol)",
    fields: [
      { name: 'FSG (Follikulostimulyar gormon)', norm: 'Jins/faza bo\'yicha', unit: 'mIU/ml' },
      { name: 'LG (Lyuteinizirlovchi gormon)', norm: 'Jins/faza bo\'yicha', unit: 'mIU/ml' },
      { name: 'Prolaktin', norm: 'Erkak: 60-560 mIU/l', unit: 'mIU/l' },
      { name: 'Testosteron', norm: 'Yosh bo\'yicha', unit: 'ng/ml' },
      { name: 'Progesteron', norm: 'Faza bo\'yicha', unit: 'ng/ml' },
      { name: 'Estradiol', norm: 'Faza bo\'yicha (FF/LF/Ovul/Menopauza)', unit: 'ng/ml' },
    ],
  },
  {
    key: 'LAB_MAZOK',
    category: 'Laboratoriya',
    name: "Mazok (Umumiy Flora Tahlili)",
    fields: [
      { name: 'Umumiy flora tahlili natijasi', norm: '', unit: '' },
      { name: 'Leykotsitlar', norm: '', unit: 'k.m' },
      { name: 'Epiteliy', norm: '', unit: 'k.m' },
      { name: 'Boshqa flora', norm: '', unit: '' },
    ],
  },
  {
    key: 'LAB_PARAZIT',
    category: 'Laboratoriya',
    name: "Parazitologik Tahlil",
    fields: [
      { name: 'Lyamblii (summar)', norm: 'Manfiy', unit: '' },
      { name: 'Tenida (Tasma qurt)', norm: 'Manfiy', unit: '' },
      { name: 'Askarida IgG', norm: 'Manfiy', unit: '' },
      { name: 'Exinokokk IgG', norm: 'Manfiy', unit: '' },
      { name: 'Pakana gijja', norm: 'Manfiy', unit: '' },
    ],
  },
  {
    key: 'LAB_REVMOPROBA',
    category: 'Laboratoriya',
    name: "Revmoproba (SRB/RF/ASLO)",
    fields: [
      { name: 'S-reaktiv oqsil (SRB)', norm: 'Manfiy', unit: '' },
      { name: 'RF (Revmotoid faktor)', norm: 'Manfiy', unit: '' },
      { name: 'ASLO (Antistreptolizin-O)', norm: 'Manfiy', unit: '' },
    ],
  },
  {
    key: 'LAB_SPERMOGRAMMA',
    category: 'Laboratoriya',
    name: "Spermogramma (JSST 2010)",
    fields: [
      { name: 'Rangi', norm: 'Och sut rang', unit: '' },
      { name: 'Hidi', norm: 'Spetsifik', unit: '' },
      { name: 'Ko\'rinishi', norm: 'Norma', unit: '' },
      { name: 'Konsistensiyasi', norm: 'Yopishqoq', unit: '' },
      { name: 'Suyulish vaqti', norm: '20-60 daqiqa', unit: 'daqiqa' },
      { name: 'Sperma miqdori (hajm)', norm: '2-6 ml', unit: 'ml' },
      { name: 'Sonlar (1 ml da)', norm: '15 mlndan ko\'p', unit: 'mln/ml' },
      { name: 'Eyakulyatdagi umumiy son', norm: '39 mlndan ko\'p', unit: 'mln' },
      { name: 'Harakatchanlik (motility)', norm: '40% dan ko\'p', unit: '%' },
      { name: 'Progressiv harakatchanlik', norm: '32% dan ko\'p', unit: '%' },
      { name: 'Harakatsiz spermiylar', norm: '14% dan kam', unit: '%' },
      { name: 'Normal spermiylar (morfologiya)', norm: '4% dan ko\'p', unit: '%' },
      { name: 'Anormal spermiylar', norm: '96% dan kam', unit: '%' },
      { name: 'Agglyutinatsiya', norm: 'Yo\'q', unit: '' },
      { name: 'Leykotsitlar', norm: '1 mln/ml dan kam', unit: 'mln/ml' },
      { name: 'Eritrotsitlar', norm: 'Yo\'q', unit: '' },
    ],
  },
  {
    key: 'LAB_TTG',
    category: 'Laboratoriya',
    name: "Qalqonsimon bez gormonlari (TTG/T3/T4/HGCH)",
    fields: [
      { name: 'TTG (Tireotrop gormon)', norm: '0.4-4.0 mIU/l', unit: 'mIU/l' },
      { name: 'T3 umumiy (Triyodtironin)', norm: 'Norma bo\'yicha', unit: 'nmol/l' },
      { name: 'T3 erkin', norm: 'Norma bo\'yicha', unit: 'pmol/l' },
      { name: 'T4 umumiy (Tiroksin)', norm: 'Norma bo\'yicha', unit: 'nmol/l' },
      { name: 'T4 erkin', norm: 'Norma bo\'yicha', unit: 'pmol/l' },
      { name: 'Antitela tireoperoksidazaga (Anti-TPO)', norm: 'Norma bo\'yicha', unit: '' },
      { name: 'HGCH (Xorionik gonadotropin)', norm: 'Homiladorlik haftasiga qarab', unit: 'mIU/ml' },
    ],
  },
  {
    key: 'LAB_ELEMENTLAR',
    category: 'Laboratoriya',
    name: "Elektrolitlar (Mikroelementlar)",
    fields: [
      { name: 'Natriy (Na)', norm: '135-150 mmol/l', unit: 'mmol/l' },
      { name: 'Kaliy (K)', norm: '3.5-5.1 mmol/l', unit: 'mmol/l' },
      { name: 'Xlor (Cl)', norm: '98-107 mmol/l', unit: 'mmol/l' },
      { name: 'Kalsiy (Ca)', norm: '2.15-2.55 mmol/l', unit: 'mmol/l' },
      { name: 'Temir (Fe)', norm: 'Erkak/Ayol bo\'yicha farqlanadi', unit: 'mkmol/l' },
    ],
  },
  {
    key: 'LAB_RW',
    category: 'Laboratoriya',
    name: "Vasserman Reaksiyasi (RW)",
    fields: [
      { name: 'Vasserman reaksiyasi (RW)', norm: 'Manfiy', unit: '' },
    ],
  },

  // ───────────────────────────── UZI ─────────────────────────────
  {
    key: 'UZI_BUYRAK',
    category: 'UZI',
    name: 'Buyraklar UZI',
    fields: [
      { name: 'Siydik pufagi (shakli/hajmi)', norm: 'Deformatsiyasiz, 150-350 ml', unit: '' },
      { name: 'Siydik pufagi devor qalinligi', norm: '3-5 mm', unit: 'mm' },
      { name: 'O\'ng buyrak o\'lchami', norm: '100-120 x 40-50 mm', unit: 'mm' },
      { name: 'O\'ng buyrak parenxima qalinligi', norm: '15-25 mm', unit: 'mm' },
      { name: 'O\'ng buyrak ChLS (chashka-tos sistemasi)', norm: 'Kengaymagan', unit: '' },
      { name: 'Chap buyrak o\'lchami', norm: '100-120 x 40-50 mm', unit: 'mm' },
      { name: 'Chap buyrak parenxima qalinligi', norm: '15-25 mm', unit: 'mm' },
      { name: 'Chap buyrak ChLS (chashka-tos sistemasi)', norm: 'Kengaymagan', unit: '' },
      { name: 'Prostata bezi o\'lchami (erkaklarda)', norm: '~30x25x35 mm', unit: 'mm' },
      { name: 'Qoldiq siydik', norm: '10-20 ml gacha', unit: 'ml' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_BACHADON',
    category: 'UZI',
    name: 'Bachadon va qo\'shimchalar UZI (Ginekologik)',
    fields: [
      { name: 'Siydik pufagi hajmi', norm: '150-350 ml', unit: 'ml' },
      { name: 'Bachadon uzunligi', norm: '45-55 mm', unit: 'mm' },
      { name: 'Bachadon old-orqa o\'lchami', norm: '30-40 mm', unit: 'mm' },
      { name: 'Bachadon kengligi', norm: '45-55 mm', unit: 'mm' },
      { name: 'Miometriy qalinligi', norm: '', unit: 'mm' },
      { name: 'Endometriy qalinligi', norm: 'Faza bo\'yicha farqlanadi', unit: 'mm' },
      { name: 'Bachadon bo\'yni o\'lchami', norm: '~20x30 mm', unit: 'mm' },
      { name: 'Servikal kanal', norm: 'Kengaymagan', unit: '' },
      { name: 'O\'ng tuxumdon o\'lchami', norm: '~20x30 mm', unit: 'mm' },
      { name: 'Chap tuxumdon o\'lchami', norm: '~20x30 mm', unit: 'mm' },
      { name: 'Follikula (dominant, bo\'lsa)', norm: '', unit: 'mm' },
      { name: 'Bachadon naychalari', norm: 'Kengaymagan', unit: '' },
      { name: 'Duglas bo\'shlig\'i', norm: 'Erkin suyuqlik yo\'q', unit: '' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_JIGAR',
    category: 'UZI',
    name: 'Jigar UZI (Qorin bo\'shlig\'i — jigar diagnostikasi)',
    fields: [
      { name: 'Jigar o\'ng bo\'lak KVR', norm: '~110-125 mm', unit: 'mm' },
      { name: 'Jigar chap bo\'lak KKR', norm: '~50-60 mm', unit: 'mm' },
      { name: 'Kontur/kapsula', norm: 'Tekis, aniq', unit: '' },
      { name: 'Parenxima exogenligi', norm: 'O\'rtacha', unit: '' },
      { name: 'Ichki jigar o\'t yo\'llari', norm: 'Kengaymagan', unit: '' },
      { name: 'Portal vena diametri', norm: '8-12 mm', unit: 'mm' },
      { name: 'I.V.C. diametri', norm: '15-20 mm', unit: 'mm' },
      { name: 'O\'t pufagi o\'lchami', norm: '~70x30 mm', unit: 'mm' },
      { name: 'O\'t pufagi devor qalinligi', norm: '2-3 mm', unit: 'mm' },
      { name: 'Xoledox diametri', norm: '2-6 mm', unit: 'mm' },
      { name: 'Oshqozon osti bezi (bosh/tana/dum)', norm: '~18-20/14-16/16-18 mm', unit: 'mm' },
      { name: 'Virsung yo\'li', norm: 'Kengaymagan', unit: '' },
      { name: 'Taloq o\'lchami', norm: '~90x35 mm', unit: 'mm' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_QORIN_UMUMIY',
    category: 'UZI',
    name: 'Qorin bo\'shlig\'i UZI (Umumiy, kattalar)',
    fields: [
      { name: 'Jigar (KVR/KKR, kontur, exogenlik)', norm: '', unit: '' },
      { name: 'O\'t pufagi (o\'lcham, devor, tarkib)', norm: '', unit: '' },
      { name: 'Oshqozon osti bezi (bosh/tana/dum)', norm: '', unit: '' },
      { name: 'Taloq o\'lchami', norm: '~90x35 mm', unit: 'mm' },
      { name: 'O\'ng buyrak o\'lchami', norm: '100-120 x 40-50 mm', unit: 'mm' },
      { name: 'Chap buyrak o\'lchami', norm: '100-120 x 40-50 mm', unit: 'mm' },
      { name: 'Prostata bezi (erkaklarda)', norm: '', unit: '' },
      { name: 'Qoldiq siydik', norm: '', unit: 'ml' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_QORIN_BOLALAR',
    category: 'UZI',
    name: 'Qorin bo\'shlig\'i UZI (Bolalar)',
    fields: [
      { name: 'Jigar KVR (o\'ng bo\'lak)', norm: 'Yoshga qarab', unit: 'mm' },
      { name: 'Jigar konturi/parenximasi', norm: 'Tekis, o\'rtacha exogenlik', unit: '' },
      { name: 'O\'t pufagi o\'lchami/devor', norm: '', unit: 'mm' },
      { name: 'Oshqozon osti bezi (bosh/tana/dum)', norm: 'Yoshga qarab', unit: 'mm' },
      { name: 'Taloq o\'lchami', norm: 'Yoshga qarab', unit: 'mm' },
      { name: 'O\'ng buyrak o\'lchami', norm: 'Yoshga qarab', unit: 'mm' },
      { name: 'Chap buyrak o\'lchami', norm: 'Yoshga qarab', unit: 'mm' },
      { name: 'Siydik pufagi hajmi/devor', norm: '', unit: '' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_ZOB',
    category: 'UZI',
    name: 'Qalqonsimon bez (Zob) UZI',
    fields: [
      { name: 'Bo\'yinturuq (isthmus) qalinligi', norm: '4-6 mm', unit: 'mm' },
      { name: 'O\'ng bo\'lak uzunligi', norm: '40-60 mm', unit: 'mm' },
      { name: 'O\'ng bo\'lak qalinligi', norm: '16-18 mm', unit: 'mm' },
      { name: 'O\'ng bo\'lak kengligi', norm: '13-18 mm', unit: 'mm' },
      { name: 'Chap bo\'lak uzunligi', norm: '40-60 mm', unit: 'mm' },
      { name: 'Chap bo\'lak qalinligi', norm: '16-18 mm', unit: 'mm' },
      { name: 'Chap bo\'lak kengligi', norm: '13-18 mm', unit: 'mm' },
      { name: 'Shakli/kontur/exostruktura', norm: '', unit: '' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_TOMIRLAR',
    category: 'UZI',
    name: 'Qon-tomirlari UZI (Oyoq arteriya-vena, Doppler)',
    fields: [
      { name: 'Arteriyalar o\'tkazuvchanligi', norm: 'Saqlangan', unit: '' },
      { name: 'Qon oqimi spektri (arteriya)', norm: '3 fazali, yuqori qarshilikli', unit: '' },
      { name: 'Intima-media kompleksi', norm: '0.9 mm gacha', unit: 'mm' },
      { name: 'Ateroskleroz belgilari', norm: 'Aniqlanmadi', unit: '' },
      { name: 'Stenoz/okklyuziya', norm: 'Aniqlanmadi', unit: '' },
      { name: 'Venalar o\'tkazuvchanligi', norm: 'Saqlangan', unit: '' },
      { name: 'Vena devorlari', norm: 'Yupqa, o\'zgarishsiz', unit: '' },
      { name: 'Klapan funksiyasi', norm: 'Saqlangan, refluks yo\'q', unit: '' },
      { name: 'Sayoz teri osti venasi', norm: 'Kengaymagan', unit: '' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_NEYROSONOGRAFIYA',
    category: 'UZI',
    name: 'Neyrosonografiya (Bosh miya, chaqaloq)',
    fields: [
      { name: 'G\'ovak va egatlar rasmi', norm: 'Aniq', unit: '' },
      { name: 'Subaraxnoidal bo\'shliq (o\'ng/chap)', norm: '3 mm gacha', unit: 'mm' },
      { name: 'Yarim sharlar orasi yorig\'i', norm: '3 mm gacha', unit: 'mm' },
      { name: 'Yuqori sagittal sinus', norm: '3 mm gacha', unit: 'mm' },
      { name: 'Yon qorinchalar (tana darajasi, o\'ng/chap)', norm: '2-4 mm', unit: 'mm' },
      { name: 'Yon qorinchalar (oldingi shoxlar, o\'ng/chap)', norm: '2-4 mm', unit: 'mm' },
      { name: 'III qorincha kengligi', norm: '3 mm gacha', unit: 'mm' },
      { name: 'IV qorincha chuqurligi', norm: '4 mm gacha', unit: 'mm' },
      { name: 'Katta sisterna', norm: '7-8 mm (chaqaloqda 10 mm gacha)', unit: 'mm' },
      { name: 'Tomir chigallari (o\'ng/chap)', norm: 'Tekis, simmetrik', unit: '' },
      { name: 'Dopplerometriya PMA RI', norm: '0.60-0.70', unit: '' },
      { name: 'Dopplerometriya SMA RI', norm: '0.60-0.70', unit: '' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
  {
    key: 'UZI_MOYAK',
    category: 'UZI',
    name: 'Moyaklar UZI (Skrotal)',
    fields: [
      { name: 'O\'ng moyak joylashishi/chetlari', norm: 'Norma', unit: '' },
      { name: 'O\'ng moyak o\'lchami (uzunlik/kenglik/qalinlik)', norm: '40-45 / 20-35 / 20-25 mm', unit: 'mm' },
      { name: 'O\'ng moyak exogenligi/qon oqimi', norm: 'Izoexogen, norma', unit: '' },
      { name: 'O\'ng moyak ortig\'i o\'lchami', norm: '~10x12 mm', unit: 'mm' },
      { name: 'Chap moyak joylashishi/chetlari', norm: 'Norma', unit: '' },
      { name: 'Chap moyak o\'lchami (uzunlik/kenglik/qalinlik)', norm: '40-45 / 20-35 / 20-25 mm', unit: 'mm' },
      { name: 'Chap moyak exogenligi/qon oqimi', norm: 'Izoexogen, norma', unit: '' },
      { name: 'Chap moyak ortig\'i o\'lchami', norm: '~10x12 mm', unit: 'mm' },
      { name: 'Urug\' tizimchasi venalari', norm: 'Kengaymagan', unit: '' },
      { name: 'Erkin suyuqlik (yog\'oq bo\'shlig\'ida)', norm: 'Yo\'q/kam miqdorda', unit: 'ml' },
      { name: 'Xulosa', norm: '', unit: '' },
    ],
  },
]

export function getTemplateByKey(key) {
  return REPORT_TEMPLATES.find((t) => t.key === key) || null
}

// Xizmat category/nomidan qaysi shablon guruhi tegishli ekanini taxmin qiladi.
// Aniq shablon (masalan "UZI_BUYRAK") emas, faqat "UZI" | "Laboratoriya" | null qaytaradi —
// aniq turini keyin shifokorning o'zi tanlaydi (bitta xizmatga bir nechta yo'nalish tegishli
// bo'lishi mumkin, masalan UZI'da "1 ta soha" narx darajasi ostida 9 xil tekshiruv bo'lishi mumkin).
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
