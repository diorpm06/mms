import Modal from './Modal'
import { formatMoney } from '../utils/format'
import { Bed, UserCheck, Stethoscope, FileText, Calendar, CreditCard, PlusCircle, DollarSign, ShieldAlert } from 'lucide-react'

export default function InpatientDetailsModal({ inpatient, onClose, onAddItem, onPay, onExtend }) {
  if (!inpatient) return null

  const items = inpatient.items || []
  const payments = inpatient.payments || []

  return (
    <Modal open={!!inpatient} onClose={onClose} title="Statsionar Bemor To'liq Kartasi va Xizmatlar Ro'yxati" size="xl">
      <div className="space-y-4 pt-1">
        {/* Header Profile Info */}
        <div className="bg-surface-2/60 border border-gold/30 p-3.5 rounded-2xl flex flex-wrap justify-between items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-gold">
                {inpatient.first_name} {inpatient.last_name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                <Bed className="h-3.5 w-3.5" /> {inpatient.room_number || 'Palata'} / Koyka {inpatient.bed_number}
              </span>
            </div>
            <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>📞 Tel: <b>{inpatient.phone || 'Kiritilmagan'}</b></span>
              <span>👨‍⚕️ Shifokor: <b>{inpatient.doctor_name || 'Biriktirilmagan'}</b></span>
              <span>📅 Yotqizilgan sana: <b>{inpatient.admitted_at ? new Date(inpatient.admitted_at).toLocaleString('uz-UZ') : '—'}</b></span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {onExtend && (
              <button
                type="button"
                onClick={onExtend}
                className="btn-outline border-amber-500/40 text-amber-300 hover:bg-amber-950/40 text-xs py-1.5 px-3 font-bold flex items-center gap-1.5"
              >
                <Calendar className="h-4 w-4" /> 📅 Kun uzaytirish
              </button>
            )}
            {onAddItem && (
              <button
                type="button"
                onClick={onAddItem}
                className="btn-outline border-purple-500/40 text-purple-300 hover:bg-purple-950/40 text-xs py-1.5 px-3 font-bold flex items-center gap-1.5"
              >
                <PlusCircle className="h-4 w-4" /> + Xizmat/Dori
              </button>
            )}
            {onPay && (
              <button
                type="button"
                onClick={onPay}
                className="btn-gold text-xs py-1.5 px-3 font-bold flex items-center gap-1.5"
              >
                <CreditCard className="h-4 w-4" /> To'lov Qabul Qilish
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Summary: Tariff Stay Info & Financial Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Stay & Tariff Details */}
          <div className="bg-surface p-3.5 rounded-2xl border border-border space-y-2">
            <h3 className="font-extrabold text-gold flex items-center gap-1.5 text-xs uppercase">
              <Calendar className="h-4 w-4" /> Yotish va Tarif Tafsilotlari
            </h3>
            <div className="space-y-1.5 text-muted">
              <div className="flex justify-between">
                <span>Tarif paketi:</span>
                <strong className="text-cyan-300">{inpatient.tariff_name || 'Standart'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Kunlik krovat narxi:</span>
                <strong className="font-mono text-foreground">{formatMoney(inpatient.daily_rate)} / kun</strong>
              </div>
              <div className="flex justify-between">
                <span>Yotgan muddat:</span>
                <strong className="text-foreground">{inpatient.days} kun (Reja: {inpatient.planned_days || inpatient.days || 1} kun)</strong>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-border/50 text-foreground font-bold">
                <span>Palata hisobi (Kun x Narx):</span>
                <span className="font-mono text-gold">{formatMoney(inpatient.room_total || (inpatient.days * inpatient.daily_rate))}</span>
              </div>
            </div>
          </div>

          {/* Financial Balance Summary */}
          <div className="bg-surface p-3.5 rounded-2xl border border-border space-y-2">
            <h3 className="font-extrabold text-gold flex items-center gap-1.5 text-xs uppercase">
              <DollarSign className="h-4 w-4" /> Balans va Hisob-Kitob
            </h3>
            <div className="space-y-1.5 font-mono">
              <div className="flex justify-between text-muted">
                <span>Jami Hisob (Palata + Xizmatlar):</span>
                <strong className="text-foreground">{formatMoney(inpatient.total_amount)}</strong>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Jami To'langan Summa:</span>
                <strong>{formatMoney(inpatient.paid_total)}</strong>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-border/50 text-sm font-extrabold">
                <span className="text-muted">Qoldiq (Qarz):</span>
                <span className={inpatient.balance_due > 0 ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>
                  {inpatient.balance_due > 0 ? formatMoney(inpatient.balance_due) : '0 so\'m (To\'liq)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: ATTACHED EXTRA SERVICES & MATERIALS */}
        <div className="bg-surface p-4 rounded-2xl border border-border space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-extrabold text-gold text-xs flex items-center gap-1.5 uppercase">
              <Stethoscope className="h-4 w-4" /> Foydalanilayotgan Qo'shimcha Xizmatlar va Dori-Darmonlar ({items.length})
            </h3>
            {inpatient.extra_items_total > 0 && (
              <span className="text-xs font-mono text-purple-300 font-bold bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-500/30">
                Jami qo'shimchalar: +{formatMoney(inpatient.extra_items_total)}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center p-5 bg-surface-2/30 rounded-xl border border-dashed border-border text-muted text-xs italic">
              Bemorga hali qo'shimcha tahlillar, xizmatlar yoki dori-darmonlar biriktirilmagan.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[700px] text-xs">
                <thead>
                  <tr className="bg-surface-2/80 border-b border-border text-left text-muted font-extrabold">
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">Xizmat / Dori Nomi</th>
                    <th className="p-2.5">Turi</th>
                    <th className="p-2.5 text-center">Soni</th>
                    <th className="p-2.5 text-right">Birlik Narxi</th>
                    <th className="p-2.5 text-right">Jami Summa</th>
                    <th className="p-2.5 text-center">Tarifdagi Holati</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-surface">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-surface-2/60 transition-all">
                      <td className="p-2.5 text-center font-mono text-muted">{idx + 1}</td>
                      <td className="p-2.5 font-extrabold text-foreground">{it.name}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        {it.item_type === 'material' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap inline-block">
                            💉 Dori / Material
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-block">
                            🩺 Tahlil / Xizmat
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold whitespace-nowrap">{it.quantity} ta</td>
                      <td className="p-2.5 text-right font-mono text-muted whitespace-nowrap">{formatMoney(it.unit_price)}</td>
                      <td className="p-2.5 text-right font-mono font-black text-gold whitespace-nowrap">{formatMoney(it.total_price)}</td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        {it.is_included_in_tariff ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap inline-block">
                            ✓ Tarif ichida (0 so'm)
                          </span>
                        ) : it.is_no_charge ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-block">
                            Balansga qo'shilmaydi
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap inline-block">
                            Alohida to'lanadi
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION: PAYMENT HISTORY */}
        <div className="bg-surface p-3.5 rounded-2xl border border-border space-y-2.5">
          <h3 className="font-extrabold text-gold text-xs flex items-center gap-1.5 uppercase">
            <FileText className="h-4 w-4" /> To'lovlar Tarixi va Sanalari ({payments.length})
          </h3>

          {payments.length === 0 ? (
            <div className="text-center p-3 bg-surface-2/30 rounded-xl border border-dashed border-border text-muted text-xs italic">
              Bemor hali to'lov qilmagan (Nasiya / Chiqishda to'lash sharti bilan).
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {payments.map((p, idx) => {
                const stLabel = p.payment_stage === 'advance' ? '🟢 Bosh To\'lov' : (p.payment_stage === 'interim' ? '🟡 Oraliq To\'lov' : '🔴 Chiqish To\'lovi')
                const pTypeMap = { cash: '💵 Naqd', card: '💳 Karta', click: '📱 Click/Payme', payme: '📱 Payme', split: '🔀 Aralash', qr: '🔳 QR Kod', later: '⏳ Nasiya' }
                const typeLabel = pTypeMap[p.payment_type] || p.payment_type || 'Naqd'
                const pDate = p.created_at ? new Date(p.created_at).toLocaleString('uz-UZ') : ''

                return (
                  <div key={p.id || idx} className="flex justify-between items-center text-xs p-2 bg-surface-2/50 rounded-xl border border-border">
                    <div className="space-y-0.5">
                      <div className="font-bold text-foreground">
                        {idx + 1}-to'lov: <span className="text-emerald-400 font-mono font-bold">{formatMoney(p.amount)}</span>
                      </div>
                      <div className="text-[10px] text-muted flex gap-2">
                        <span>{stLabel}</span>
                        <span>•</span>
                        <span>{typeLabel}</span>
                        <span>•</span>
                        <span>{pDate}</span>
                      </div>
                    </div>
                    <span className="font-mono text-emerald-400 font-black text-sm">- {formatMoney(p.amount)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
