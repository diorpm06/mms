import { useState } from 'react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'

const CATEGORIES = [
  'Kommunal',
  "Ta'mirlash",
  'Jihozlar',
  "Dori-darmon",
  'Transport',
  'Reklama',
  'Boshqa',
]
const SOURCES = ['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa']

export default function AdminExpenses() {
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [category,    setCategory]    = useState('')
  const [source,      setSource]      = useState('Naqt kassa')
  const [loading,     setLoading]     = useState(false)
  const toast = useToastStore((s) => s.add)

  const submit = async () => {
    if (!description || !amount) {
      toast('Tavsif va summa kiriting', 'error')
      return
    }
    setLoading(true)
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          description,
          amount: parseInt(amount, 10),
          category: category || null,
          source,
        }),
      })
      toast('Harajat saqlandi')
      setDescription('')
      setAmount('')
      setCategory('')
      setSource('Naqt kassa')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="page-title mb-6">Harajat kiritish</h1>
      <div className="card space-y-4">
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Kategoriya
          </label>
          <select
            className="input-field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">— Kategoriya tanlanmagan</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Pul manbasi
          </label>
          <select className="input-field" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Tavsif *
          </label>
          <input
            className="input-field"
            placeholder="Harajat nima uchun?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wide">
            Summa (so'm) *
          </label>
          <input
            className="input-field"
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-gold w-full py-2.5"
          disabled={loading}
          onClick={submit}
        >
          {loading ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </div>
  )
}
