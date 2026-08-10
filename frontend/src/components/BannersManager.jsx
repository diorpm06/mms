import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { Btn, Icons } from './UIKit'
import { Trash2, Image as ImageIcon, Upload, Link as LinkIcon, CheckCircle2, Eye } from 'lucide-react'

export default function BannersManager() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const toast = useToastStore((s) => s.add)

  const fetchBanners = async () => {
    try {
      setLoading(true)
      const data = await api('/banners')
      setBanners(data || [])
    } catch (e) {
      toast(e.message || 'Bannerni yuklashda xatolik', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners()
  }, [])

  const handleAddUrl = async (e) => {
    if (e) e.preventDefault()
    if (!imageUrl.trim()) {
      toast('Rasm havolasini (URL) kiriting', 'error')
      return
    }
    setUploading(true)
    try {
      await api('/banners', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim() || 'TV Reklama Rasm', image_url: imageUrl.trim() }),
      })
      toast('Reklama rasmi qo\'shildi ✓')
      setTitle('')
      setImageUrl('')
      fetchBanners()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    if (title.trim()) formData.append('title', title.trim())

    setUploading(true)
    try {
      const { accessToken } = useAuthStore.getState()
      const res = await fetch('/api/banners/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Yuklashda xatolik' }))
        throw new Error(err.detail || 'Yuklashda xatolik')
      }
      toast('Reklama rasmi muvaffaqiyatli yuklandi ✓')
      setTitle('')
      fetchBanners()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Ushbu reklama rasmini TV ekrandan va bazadan o\'chirmoqchimisiz?')) return
    try {
      await api(`/banners/${id}`, { method: 'DELETE' })
      toast('Reklama o\'chirildi')
      setBanners((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="card space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-black text-gold flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-gold" />
            TV Navbat Ekrani Reklama Bannerlari va Aksiyalar
          </h2>
          <p className="text-xs text-muted mt-1 font-medium">
            TV ekranda 10 soniyadan navbatma-navbat almashib turadigan reklama rasmlarini va videolarini boshqarish
          </p>
        </div>
        <span className="badge badge-gold font-mono text-xs px-3 py-1">
          📺 {banners.length} ta faol reklama
        </span>
      </div>

      {/* UPLOAD FORM CARD */}
      <div className="card-2 p-5 border border-border space-y-4 rounded-2xl">
        <h3 className="text-xs font-black uppercase tracking-wider text-cyan flex items-center gap-2">
          <Upload className="h-4 w-4" /> 1. Yangi Reklama Rasmi yoki Videosi Qo'shish
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title Input */}
          <div>
            <label className="form-label text-xs font-bold">Reklama Nomi / Sarlavhasi (ixtiyoriy)</label>
            <input
              className="input-field text-xs font-semibold"
              placeholder="Masalan: UZI ko'rik aksiya banneri"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* File Upload Input */}
          <div>
            <label className="form-label text-xs text-gold font-bold">🖼️ Kompyuterdan Rasm yoki Video Yuklash *</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*,video/*"
                className="input-field text-xs py-1.5 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gold-dim file:text-gold hover:file:bg-gold"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
          </div>
        </div>

        {/* OR URL INPUT */}
        <div className="pt-3 border-t border-border">
          <label className="form-label text-xs text-muted flex items-center gap-1">
            <LinkIcon className="h-3.5 w-3.5" /> Yoki Fayl / Video Havolasi (URL) orqali kiritish:
          </label>
          <div className="flex gap-2">
            <input
              className="input-field flex-1 text-xs"
              placeholder="https://site.uz/images/banner1.jpg yoki .mp4"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <Btn variant="cyan" size="sm" onClick={handleAddUrl} loading={uploading} disabled={uploading}>
              Qo'shish
            </Btn>
          </div>
        </div>
      </div>

      {/* BANNERS GALLERY LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-body flex items-center gap-2">
            📸 TV Ekranda Almashib Turadigan Reklamalar Ro'yxati
          </h3>
          <span className="text-[11px] font-bold text-muted">
            10 soniyadan slayd bo'lib almashadi
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted italic">
            Reklama rasmlari yuklanmoqda...
          </div>
        ) : banners.length === 0 ? (
          <div className="py-12 text-center text-muted text-xs card-2 border border-dashed border-border rounded-2xl space-y-2">
            <div className="text-3xl">🖼️</div>
            <p className="font-bold text-body">Hali reklama rasmi qo'shilmagan</p>
            <p className="text-[11px] text-muted">
              Yuqoridagi maydon orqali rasm yoki video yuklasangiz, u darhol TV Navbat ekranida chiqa boshlaydi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {banners.map((b, idx) => {
              const rawUrl = b.image_url || ''
              const bUrl = rawUrl.startsWith('http') ? rawUrl : (rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`)
              const isVideo = bUrl && /\.(mp4|webm|ogg|mov)$/i.test(bUrl)
              return (
                <div
                  key={b.id}
                  className="card-2 p-3 border border-border rounded-2xl space-y-3 relative group hover:border-gold transition-all shadow-md"
                >
                  {/* Badge */}
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="badge badge-gold font-mono">#{idx + 1}</span>
                    <span className="badge badge-success flex items-center gap-1 font-extrabold text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> TV Ekranda Aktiv
                    </span>
                  </div>

                  {/* Image/Video Container */}
                  <div className="h-44 w-full rounded-xl overflow-hidden bg-surface-2 flex items-center justify-center relative border border-border">
                    {isVideo ? (
                      <video
                        src={bUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <img
                        src={bUrl}
                        alt={b.title || 'Reklama banner'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                      />
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      className="absolute top-2 right-2 p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xl transition-all border border-rose-400 shrink-0 z-10"
                      title="Reklamani TV ekrandan olib tashlash (O'chirish)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Title & Created Info */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <h4 className="text-xs font-black text-body truncate">
                        {b.title || 'TV Reklama Banneri'}
                      </h4>
                      <p className="text-[10px] text-muted font-mono">
                        Qo'shilgan: {b.created_at ? b.created_at.slice(0, 10) : 'Bugun'}
                      </p>
                    </div>

                    <a
                      href={b.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-surface border border-border text-muted hover:text-body transition-all shrink-0"
                      title="Rasmni to'liq hajmini ko'rish"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
