import { useEffect, useState } from 'react'
import { Building2, Bed } from 'lucide-react'
import { formatMoney } from '../utils/format'
import { api } from '../utils/api'

export default function VisualRoomMap({ rooms: propRooms, activeInpatients, onAdmitRoom, onDischarge, onPrintReceipt, onAddItem, onPay, onViewPatient }) {
  const [fetchedRooms, setFetchedRooms] = useState(null)

  useEffect(() => {
    if (propRooms === undefined) {
      api('/inpatients/rooms')
        .then(setFetchedRooms)
        .catch(() => {})
    }
  }, [propRooms])

  const roomsList = propRooms !== undefined ? propRooms : (fetchedRooms || [])

  const normKey = (str) => String(str || '').toLowerCase().replace(/no\.|№|#|palata|koyka|xona|room|\s/gi, '').trim()

  // Build map of rooms & beds
  const roomsMap = {}

  if (roomsList && roomsList.length > 0) {
    roomsList.forEach((r) => {
      const roomKey = r.room_number || 'Palata №1'
      roomsMap[roomKey] = (r.beds || []).map((b) => ({
        bed: b.bed_number,
        patient: null,
      }))
    })
  }

  // Populate active inpatients into matching beds
  (activeInpatients || []).forEach((inp) => {
    if (!inp || !inp.room_number) return
    const rawRoom = String(inp.room_number).trim()
    const rawBed = String(inp.bed_number || '').trim()
    const normRoom = normKey(rawRoom)
    const normBed = normKey(rawBed)

    // Find matching room key in roomsMap
    let matchedRoomKey = Object.keys(roomsMap).find((k) => {
      if (k === rawRoom) return true
      if (normRoom && normKey(k) === normRoom) return true
      return false
    })

    if (!matchedRoomKey) {
      matchedRoomKey = rawRoom
      roomsMap[matchedRoomKey] = []
    }

    const bedList = roomsMap[matchedRoomKey]
    const bedObj = bedList.find((b) => {
      if (String(b.bed).trim() === rawBed) return true
      if (normBed && normKey(b.bed) === normBed) return true
      return false
    })

    if (bedObj) {
      bedObj.patient = inp
    } else {
      bedList.push({ bed: inp.bed_number || 'Koyka 1', patient: inp })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-gold flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Palatalar va Koykalar Vizual Xaritasi
        </h2>
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Bo'sh Koyka</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" /> Band (Bemor bor)</span>
        </div>
      </div>

      {Object.keys(roomsMap).length === 0 ? (
        <div className="text-center p-8 bg-surface rounded-2xl border border-border text-muted">
          Palatalar topilmadi. Sozlamalardan yangi palata qo'shishingiz mumkin.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {Object.entries(roomsMap).map(([roomName, beds]) => (
            <div
              key={roomName}
              className="bg-surface rounded-3xl border border-border p-4 shadow-xl hover:border-gold/30 transition-all flex flex-col justify-start h-fit"
            >
              <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-border">
                <h3 className="font-extrabold text-gold text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> {roomName}
                </h3>
                <span className="text-[10px] font-bold text-muted uppercase bg-surface-2 px-2 py-0.5 rounded-full border border-border">
                  {beds.length} Koyka
                </span>
              </div>

              <div className="space-y-3">
                {beds.map((b, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border text-xs transition-all ${
                      b.patient
                        ? 'bg-cyan-950/30 border-cyan-500/40 text-foreground shadow-md'
                        : 'bg-emerald-950/10 border-emerald-500/25 border-dashed text-muted hover:border-emerald-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1.5">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Bed className={`h-4 w-4 ${b.patient ? 'text-cyan-400' : 'text-emerald-400'}`} />
                        {b.bed?.toString().startsWith('Koyka') ? b.bed : `Koyka ${b.bed}`}
                      </span>
                      {b.patient ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-extrabold border border-cyan-500/40">
                          {b.patient.planned_days
                            ? `${b.patient.days || b.patient.days_count || 1}/${b.patient.planned_days} kun`
                            : `${b.patient.days || b.patient.days_count || 1} kun`}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/40">
                          BO'SH
                        </span>
                      )}
                    </div>

                    {b.patient ? (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => onViewPatient && onViewPatient(b.patient)}
                            className="font-extrabold text-sm text-cyan-300 hover:underline hover:text-cyan-200 text-left truncate flex-1"
                            title="Bemor tibbiy kartasini ko'rish"
                          >
                            {b.patient.first_name} {b.patient.last_name}
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewPatient && onViewPatient(b.patient)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 font-bold shrink-0"
                            title="Tibbiy kartani ko'rish"
                          >
                            👁️ Kartochka
                          </button>
                        </div>
                        
                        <div className="text-[10px] font-mono space-y-0.5 p-1.5 bg-surface-2/40 rounded-xl border border-border/50">
                          <div className="flex justify-between text-muted">
                            <span>Jami: {formatMoney(b.patient.total_amount)}</span>
                            <span className="text-emerald-400 font-bold">To'langan: {formatMoney(b.patient.paid_total)}</span>
                          </div>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-muted">Qoldiq (Qarz):</span>
                            <span className={b.patient.balance_due > 0 ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>
                              {b.patient.balance_due > 0 ? formatMoney(b.patient.balance_due) : '0 so\'m (To\'liq)'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="pt-1 grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => onPay && onPay(b.patient)}
                            className="btn-outline border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/50 py-1 px-1.5 text-[10px] font-bold flex items-center justify-center gap-1 rounded-lg"
                            title="To'lov qabul qilish"
                          >
                            💳 To'lov
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddItem && onAddItem(b.patient)}
                            className="btn-outline border-purple-500/40 text-purple-300 hover:bg-purple-950/50 py-1 px-1.5 text-[10px] font-bold flex items-center justify-center gap-1 rounded-lg"
                            title="Qo'shimcha tahlil, xizmat yoki dori biriktirish"
                          >
                            🧪 +Xizmat
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintReceipt(b.patient)}
                            className="btn-outline border-gold/40 text-gold hover:bg-gold/10 py-1 px-1.5 text-[10px] font-bold flex items-center justify-center gap-1 rounded-lg"
                            title="Kvitansiya chekini ko'rish va chop etish"
                          >
                            🧾 Chek
                          </button>
                          <button
                            type="button"
                            onClick={() => onDischarge(b.patient)}
                            className="btn-gold py-1 px-1.5 text-[10px] font-bold flex items-center justify-center gap-1 rounded-lg"
                            title="Bemor kasalxonadan chiqarish"
                          >
                            🚪 Chiqarish
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => onAdmitRoom(roomName, b.bed)}
                          className="btn-outline border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 w-full py-1 text-[11px] font-bold"
                        >
                          + Bemor qabul qilish
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
