import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { formatMoney } from '../../utils/format'
import { useToastStore } from '../../store/toastStore'
import PageHeader from '../../components/PageHeader'
import { TableSkeleton } from '../../components/Skeleton'
import { Btn, Icons, THead, StatusBadge, EmptyState } from '../../components/UIKit'

export default function CeoSavedReports() {
  const [reports, setReports] = useState(null)
  const [filterType, setFilterType] = useState('all') // 'all' | 'daily' | 'ten_day'
  const [loadingAction, setLoadingAction] = useState(false)
  const toast = useToastStore((s) => s.add)

  const load = () => {
    const query = filterType !== 'all' ? `?type=${filterType}` : ''
    api(`/reports/saved${query}`)
      .then(setReports)
      .catch((e) => toast(e.message, 'error'))
  }

  useEffect(() => {
    load()
  }, [filterType])

  const handleSaveTodayNow = async () => {
    setLoadingAction(true)
    try {
      await api('/reports/save-daily', { method: 'POST' })
      toast("Bugungi hisobot saqlandi va PDF yaratildi ✓")
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm("Ushbu hisobotni o'chirmoqchimisiz?")) return
    try {
      await api(`/reports/saved/${id}`, { method: 'DELETE' })
      toast("Hisobot o'chirildi")
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const handleDownloadPdf = async (id, title) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/reports/saved/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("PDF yuklanmadi")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bazada Saqlangan Hisobotlar"
        subtitle="Avtomatik kunlik hisobotlar va 10-kunlik PDF hujjatlar arxivi"
        icon={Icons.fileText}
      >
        <Btn
          variant="gold"
          icon={Icons.save}
          loading={loadingAction}
          onClick={handleSaveTodayNow}
        >
          Bugungi Hisobotni Saqlash
        </Btn>
      </PageHeader>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: 'Barchasi' },
          { id: 'daily', label: '📅 Kunlik Hisobotlar' },
          { id: 'ten_day', label: '📆 10-Kunlik Hisobotlar' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filterType === t.id
                ? 'bg-gold/15 border-gold/40 text-gold shadow-sm'
                : 'bg-card border-border/60 text-slate-400 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reports Table */}
      {!reports ? (
        <TableSkeleton />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <THead cols={['Hisobot Nomi', 'Turi', 'Davr', 'Bemorlar', 'Jami Tushum', 'Yaratilgan Vaqt', 'Amallar']} />
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon="📁"
                      message="Saqlangan hisobotlar topilmadi"
                      action={
                        <Btn variant="gold" icon={Icons.save} onClick={handleSaveTodayNow}>
                          Bugungisini Saqlash
                        </Btn>
                      }
                    />
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="td-cell font-bold text-foreground">{r.title}</td>
                    <td className="td-cell">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          r.report_type === 'daily'
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        }`}
                      >
                        {r.report_type === 'daily' ? '📅 Kunlik' : '📆 10-Kunlik'}
                      </span>
                    </td>
                    <td className="td-cell font-mono text-xs text-slate-300">
                      {r.period_start === r.period_end ? r.period_start : `${r.period_start} — ${r.period_end}`}
                    </td>
                    <td className="td-cell font-bold text-slate-200">
                      {r.data?.patients_count ?? '—'} ta
                    </td>
                    <td className="td-cell font-bold accent-value">
                      {r.data?.total_income ? formatMoney(r.data.total_income) : '—'}
                    </td>
                    <td className="td-cell text-xs text-muted font-mono">
                      {new Date(r.created_at).toLocaleString('uz-UZ')}
                    </td>
                    <td className="td-cell">
                      <div className="flex items-center gap-2">
                        <Btn
                          variant="gold"
                          size="xs"
                          icon={Icons.download}
                          onClick={() => handleDownloadPdf(r.id, r.title)}
                        >
                          PDF Yuklash
                        </Btn>
                        <Btn
                          variant="danger"
                          size="xs"
                          icon={Icons.trash}
                          onClick={() => handleDelete(r.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
