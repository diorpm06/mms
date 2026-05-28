import { useEffect, useState } from 'react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'

export default function CeoBackup() {
  const toast = useToastStore((s) => s.add)
  const [form, setForm] = useState({ url: '', enabled: false, token: '', last_sync_at: '' })
  const [loading, setLoading] = useState(false)
  const webhookUrl = `${window.location.origin}/api/webhook/sheets`
  const standardHeaders = [
    'first_name',
    'last_name',
    'birth_date',
    'phone',
    'address',
    'service_name',
    'provider_name',
    'referrer_name',
    'payment_amount',
    'payment_type',
    'created_at',
  ]

  const load = async () => {
    const cfg = await api('/sheets-backup/config')
    setForm({
      url: cfg.url || '',
      enabled: !!cfg.enabled,
      token: cfg.token || '',
      last_sync_at: cfg.last_sync_at || '',
    })
  }

  useEffect(() => {
    load().catch((e) => toast(e.message, 'error'))
  }, [])

  const save = async () => {
    if (!form.url) return toast('URL kiriting', 'error')
    setLoading(true)
    try {
      await api('/sheets-backup/config', {
        method: 'POST',
        body: JSON.stringify({
          url: form.url.trim(),
          enabled: form.enabled,
          token: form.token.trim(),
        }),
      })
      toast('Backup URL saqlandi')
      await load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const test = async () => {
    setLoading(true)
    try {
      const res = await api('/sheets-backup/test', { method: 'POST' })
      toast(`Ulandi. Topilgan qatorlar: ${res.rows_found}`)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const sync = async () => {
    setLoading(true)
    try {
      const res = await api('/sheets-backup/sync', { method: 'POST' })
      toast(`Sync: yangi ${res.inserted}, mavjud ${res.exists}, o'tkazildi ${res.skipped}`)
      await load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3">
        <h1 className="page-title">Sheets backup ulash</h1>
        <input
          className="input-field"
          placeholder="Apps Script Web App URL"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <input
          className="input-field"
          placeholder="Token (ixtiyoriy)"
          value={form.token}
          onChange={(e) => setForm({ ...form, token: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Avtomatik sync yoqilsin (har 2 daqiqa)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="btn-gold" onClick={save} disabled={loading}>Saqlash</button>
          <button type="button" className="btn-outline" onClick={test} disabled={loading}>Test</button>
          <button type="button" className="btn-outline" onClick={sync} disabled={loading}>Hozir sync</button>
        </div>
        <p className="text-muted text-xs">Oxirgi sync: {form.last_sync_at || 'hali yo‘q'}</p>
      </div>

      <div className="card space-y-3">
        <h2 className="accent-value font-semibold">Webhook manzili (Apps Script uchun)</h2>
        <p className="text-muted text-sm">Quyidagi URL’ni Apps Script ichida backend webhook sifatida ishlating:</p>
        <code className="block rounded-xl p-3 text-xs" style={{ background: 'var(--surface-2)' }}>{webhookUrl}</code>
        <p className="text-muted text-xs">
          Eslatma: bir xil bemor qayta import qilinmaydi, tizim uni “mavjud” deb hisoblaydi.
        </p>
        <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
          <p className="mb-2 text-sm font-semibold">Standart Sheets headerlar:</p>
          <p className="text-xs break-all">{standardHeaders.join(', ')}</p>
          <p className="text-muted mt-2 text-xs">
            Tavsiya: aynan shu nomlarda ustun oching, sync 100% stabil bo'ladi.
          </p>
        </div>
      </div>
    </div>
  )
}
