import { BRAND } from '../config/brand'

/**
 * Chek va kvitansiyalarning umumiy sarlavhasi.
 *
 * Ilgari har bir chek o'z sarlavhasini yozardi: birida logotip bor, birida yo'q;
 * nomi "MARJONA MED SERVIS" yoki "MARJONA MED SERVICE" deb har xil; telefon
 * matni och kulrang (text-slate-400) bo'lgani uchun termal printerda deyarli
 * bosilmasdi.
 *
 * `subtitle` — chek turi (masalan "Statsionar Bemor Kvitansiyasi").
 */
export default function ReceiptHeader({ subtitle = null, compact = false }) {
  return (
    <div className="text-center pb-3 border-b border-dashed border-slate-400 dark:border-slate-600">
      <img
        src={BRAND.logo}
        alt={BRAND.name}
        className="logo-img mx-auto mb-1 object-contain h-16 max-h-16"
      />
      <h2 className={`font-black tracking-wider uppercase text-slate-900 dark:text-slate-100 ${compact ? 'text-xs' : 'text-base'}`}>
        {BRAND.name}
      </h2>
      {subtitle && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 mt-0.5">
          {subtitle}
        </p>
      )}
      {/* Qora rang — termal printerda aniq chiqishi uchun */}
      <p className={`font-black text-slate-900 dark:text-slate-200 mt-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        Tel: {BRAND.phone}
      </p>
    </div>
  )
}
