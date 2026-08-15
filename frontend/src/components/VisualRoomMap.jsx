import { Building2, User, Bed, LogOut, CheckCircle2 } from 'lucide-react'
import { formatMoney } from '../utils/format'

export default function VisualRoomMap({ activeInpatients, onAdmitRoom, onDischarge, onPrintReceipt }) {
  // Group active inpatients by room
  const roomsMap = {}
  for (let r = 1; r <= 8; r++) {
    const roomName = `Palata №${r}`
    roomsMap[roomName] = [
      { bed: 'Koyka 1', patient: null },
      { bed: 'Koyka 2', patient: null },
    ]
  }

  // Populate active patients into beds
  (activeInpatients || []).forEach((inp) => {
    const roomKey = inp.room_number?.includes('Palata') ? inp.room_number : `Palata №${inp.room_number || 1}`
    if (!roomsMap[roomKey]) {
      roomsMap[roomKey] = [
        { bed: 'Koyka 1', patient: null },
        { bed: 'Koyka 2', patient: null },
      ]
    }
    const bedIdx = inp.bed_number?.includes('2') ? 1 : 0
    roomsMap[roomKey][bedIdx] = { bed: inp.bed_number || `Koyka ${bedIdx + 1}`, patient: inp }
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(roomsMap).map(([roomName, beds]) => (
          <div key={roomName} className="card border-2 border-border/80 p-4 space-y-3 bg-surface-2/10 hover:border-gold/30 transition-all">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-black text-sm text-gold">{roomName}</span>
              <span className="text-[10px] font-bold text-muted uppercase">2 Kishi</span>
            </div>

            <div className="space-y-2.5">
              {beds.map((b, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border text-xs transition-all ${
                    b.patient
                      ? 'bg-cyan-950/40 border-cyan-500/40 text-foreground'
                      : 'bg-emerald-950/20 border-emerald-500/30 border-dashed text-muted hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Bed className={`h-3.5 w-3.5 ${b.patient ? 'text-cyan-400' : 'text-emerald-400'}`} />
                      {b.bed}
                    </span>
                    {b.patient ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30">
                        {b.patient.days} kun
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        BO'SH
                      </span>
                    )}
                  </div>

                  {b.patient ? (
                    <div className="space-y-1.5 pt-1">
                      <p className="font-extrabold text-sm text-cyan-300">
                        {b.patient.first_name} {b.patient.last_name}
                      </p>
                      <p className="text-[10px] text-muted">🩺 {b.patient.doctor_name || 'Shifokor'}</p>
                      <p className="text-[11px] font-mono font-bold text-gold">{formatMoney(b.patient.total_amount)}</p>
                      
                      <div className="pt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onDischarge(b.patient)}
                          className="btn-gold py-1 px-2 text-[10px] flex-1 font-bold"
                        >
                          Chiqarish
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintReceipt(b.patient)}
                          className="btn-outline py-1 px-2 text-[10px] flex-1"
                        >
                          🧾 Chek
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
    </div>
  )
}
