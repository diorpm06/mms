import { useState } from 'react'
import { api } from '../../utils/api'
import { useToastStore } from '../../store/toastStore'
import { Btn, Icons, PageHeader } from '../../components/UIKit'

const CATEGORIES = ['Kommunal', "Ta'mirlash", 'Jihozlar', "Dori-darmon", 'Transport', 'Reklama', 'Boshqa']
const SOURCES    = ['Naqt kassa', 'Karta kassa', 'Bank hisob', 'Boshqa']

export default function AdminExpenses() {
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState('')
  const [category,    setCategory]    = useState('')
  const [source,      setSource]      = useState('Naqt kassa')
  const [loading,     setLoading]     = useState(false)
  const toast = useToastStore((s) => s.add)

  const submit = async () => {
    if (!description || !amount) { toast('Tavsif va summa kiriting', 'error'); return }
    setLoading(true)
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ description, amount: parseInt(amount, 10), category: category || null, source }),
      })
      toast('Harajat saqlandi ✓')
      setDescription('')
      setAmount('')
      setCategory('')
      setSource('Naqt kassa')
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg">
      <PageHeader
        title="Harajat Kiritish"
        subtitle="Kassadan chiqim sifatida qayd etiladi"
        icon={Icons.chart}
      />

      <div className="card space-y-4">
        <div>
          <label className="form-label">Kategoriya</label>
          <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— Kategoriya tanlanmagan</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Pul Manbasi</label>
          <select className="input-field" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Tavsif (nima uchun?) *</label>
          <input className="input-field" placeholder="Masalan: Elektr to'lovi, Shprits xaridi..."
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="form-label">Summa (so'm) *</label>
          <input className="input-field" type="number" placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <Btn variant="gold" full size="md" icon={Icons.save} loading={loading} onClick={submit}>
          {loading ? 'Saqlanmoqda...' : 'Harajatni Saqlash'}
        </Btn>
      </div>
    </div>
  )
}
