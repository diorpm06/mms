import { useEffect, useState, useRef } from 'react'
import { Send, X, Search, ArrowLeft, Maximize2, Minimize2, CheckCheck, Users } from 'lucide-react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { playNotificationSound } from '../utils/sound'
import { Btn } from './UIKit'

export default function InternalChatModal({ open, onClose }) {
  const role = useAuthStore((s) => s.role)
  const fullName = useAuthStore((s) => s.fullName)
  const userId = useAuthStore((s) => s.userId)

  const [channels, setChannels] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null) // null = show profiles list first!
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Size modes: 'compact' (small) | 'standard' (medium) | 'large' (large) | 'fullscreen' (full screen)
  const [sizeMode, setSizeMode] = useState('standard')

  const messagesEndRef = useRef(null)
  const prevMsgCountRef = useRef(null)

  // Load staff channels list
  const loadChannels = async () => {
    try {
      const data = await api('/chat/channels')
      setChannels(data || [])
    } catch (e) {
      console.error('Error fetching chat channels:', e)
    }
  }

  // Load chat messages for selected person
  const loadMessages = async () => {
    if (!selectedChannel) return
    try {
      const recipientParam = selectedChannel.id === 'group' ? 'group' : selectedChannel.id
      const data = await api(`/chat/messages?recipient_id=${recipientParam}`)
      const newMsgs = data || []
      
      if (prevMsgCountRef.current !== null && newMsgs.length > prevMsgCountRef.current) {
        const last = newMsgs[newMsgs.length - 1]
        if (last && last.sender_id !== userId) {
          playNotificationSound('chat_receive')
        }
      }
      prevMsgCountRef.current = newMsgs.length
      setMessages(newMsgs)
    } catch (e) {
      console.error('Error fetching chat messages:', e)
    }
  }

  useEffect(() => {
    if (!open) return
    // Suhbat almashganda hisoblagich tozalanadi. Aks holda oldingi
    // suhbatning xabar soni qolib, yangi suhbatda xabar ko'proq bo'lsa
    // "yangi xabar keldi" ovozi bekorga chalinardi.
    prevMsgCountRef.current = null
    loadChannels()
    if (selectedChannel) {
      loadMessages()
    }
    const interval = setInterval(() => {
      loadChannels()
      if (selectedChannel) {
        loadMessages()
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [open, selectedChannel?.id])

  useEffect(() => {
    if (open && selectedChannel) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, selectedChannel])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || sending || !selectedChannel) return
    setSending(true)
    try {
      const recipientId = selectedChannel.id === 'group' ? null : Number(selectedChannel.id)
      await api('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: recipientId,
          content: input.trim(),
        }),
      })
      // Yuboruvchida ovoz chalinmaydi — u xabarni o'zi yozgan, ogohlantirish
      // kerak emas. Ovoz faqat QABUL QILUVCHIDA chalinadi.
      setInput('')
      loadMessages()
      loadChannels()
    } catch (e) {
      alert(e.message || 'Xabar yuborishda xatolik')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  // Filter channels based on search query
  const filteredChannels = channels.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.specialization && c.specialization.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getRoleBadge = (r) => {
    if (r === 'ceo') return <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black">👑 CEO</span>
    if (r === 'doctor') return <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black">🩺 Shifokor</span>
    if (r === 'admin') return <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-black">👤 Admin</span>
    return <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black">📢 Guruh</span>
  }

  // Oyna hajmi rejimlari — kengliklar talabdagi aniq o'lchamlarda
  let containerSizeClass = 'w-full max-w-[720px] h-[580px] bottom-4 right-4 sm:bottom-6 sm:right-6'
  if (sizeMode === 'compact') {
    containerSizeClass = 'w-full max-w-[420px] h-[480px] bottom-4 right-4'
  } else if (sizeMode === 'large') {
    containerSizeClass = 'w-full max-w-[920px] h-[680px] bottom-4 right-4 sm:bottom-6 sm:right-6'
  } else if (sizeMode === 'fullscreen') {
    containerSizeClass = 'inset-2 sm:inset-6 max-w-6xl mx-auto h-[calc(100vh-48px)]'
  }

  return (
    <div
      className={`fixed z-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in zoom-in-95 ${containerSizeClass}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px var(--border-strong)',
      }}
    >
      {/* ── SLEEK HEADER WITH RESIZE CONTROLS & CLOSE ── */}
      <div className="px-4 py-3 bg-surface-2 border-b border-border flex items-center justify-between shrink-0 select-none shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedChannel ? (
            <button
              onClick={() => setSelectedChannel(null)}
              className="p-1.5 rounded-xl bg-surface border border-border hover:bg-gold/10 hover:border-gold/50 text-gold transition-all flex items-center gap-1 shrink-0 font-bold text-xs"
              title="Boshqa profilni tanlash"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Boshqa profilni tanlash</span>
            </button>
          ) : (
            <div className="p-2 rounded-xl bg-gold/10 text-gold border border-gold/30 shrink-0">
              <Users className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0">
            <h3 className="font-extrabold text-sm text-body truncate flex items-center gap-2">
              {selectedChannel ? (
                <>
                  <span>{selectedChannel.name}</span>
                  {getRoleBadge(selectedChannel.role)}
                </>
              ) : (
                <>
                  <span>Xodimlar Profillari va Chat</span>
                  <span className="badge badge-gold text-[10px] font-mono font-bold">
                    {channels.length} ta profil
                  </span>
                </>
              )}
            </h3>
            <p className="text-[11px] text-muted truncate">
              {selectedChannel
                ? selectedChannel.specialization || 'Shaxsiy muloqot xabarlari'
                : 'Muloqot qilish uchun xodim yoki guruh profilini tanlang'}
            </p>
          </div>
        </div>

        {/* WINDOW SIZE MODE SELECTOR & CLOSE BUTTON */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Size Switcher */}
          <div className="hidden sm:flex items-center bg-surface p-1 rounded-xl border border-border gap-1">
            <button
              onClick={() => setSizeMode('compact')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all ${
                sizeMode === 'compact' ? 'bg-gold text-surface-dark shadow' : 'text-muted hover:text-body'
              }`}
              title="Kichik oyna (Compact)"
            >
              📱 Kichik
            </button>
            <button
              onClick={() => setSizeMode('standard')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all ${
                sizeMode === 'standard' ? 'bg-gold text-surface-dark shadow' : 'text-muted hover:text-body'
              }`}
              title="O'rtacha oyna (Standard)"
            >
              💻 O'rtacha
            </button>
            <button
              onClick={() => setSizeMode('large')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all ${
                sizeMode === 'large' ? 'bg-gold text-surface-dark shadow' : 'text-muted hover:text-body'
              }`}
              title="Katta oyna (Large)"
            >
              🖥️ Katta
            </button>
          </div>

          <button
            onClick={() => setSizeMode(sizeMode === 'fullscreen' ? 'standard' : 'fullscreen')}
            className="p-1.5 rounded-xl hover:bg-surface-2 text-muted hover:text-body border border-border transition-all"
            title={sizeMode === 'fullscreen' ? 'Oddiy hajm' : 'To\'liq ekran'}
          >
            {sizeMode === 'fullscreen' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all"
            title="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT: PROFILES LIST VS ACTIVE CHAT ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">

        {/* ── PROFILES LIST (Displayed first, or on left sidebar in large/desktop views) ── */}
        {(!selectedChannel || sizeMode === 'large' || sizeMode === 'fullscreen') && (
          <div
            className={`${
              selectedChannel && (sizeMode === 'large' || sizeMode === 'fullscreen')
                ? 'w-72 border-r border-border shrink-0 hidden md:flex'
                : 'w-full flex-1'
            } bg-surface-2 flex flex-col min-h-0 overflow-hidden`}
          >
            {/* Search Box */}
            <div className="p-3 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder="Xodimlarni ism, shifokorlik bo'limi yoki rol bo'yicha izlash..."
                  className="input-field pl-9 py-2 text-xs font-semibold rounded-xl bg-surface"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Profiles & Channels Cards Grid / List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredChannels.length === 0 ? (
                <div className="p-8 text-center text-muted text-xs italic">
                  Qidiruv bo'yicha hech qanday profil topilmadi.
                </div>
              ) : (
                filteredChannels.map((c) => {
                  const isSelected = selectedChannel?.id === c.id
                  return (
                    <div
                      key={c.id}
                      // loadMessages() bu yerda chaqirilardi, lekin u hali
                      // ESKI selectedChannel ni ko'rardi (React holatni
                      // darhol yangilamaydi) — ya'ni oldingi suhbat
                      // xabarlarini tortib olardi. Xabarlarni quyidagi
                      // useEffect o'zi yuklaydi.
                      onClick={() => setSelectedChannel(c)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-3 group shadow-sm ${
                        isSelected
                          ? 'bg-gold/15 border-gold/50 text-gold shadow-md'
                          : 'bg-surface hover:bg-gold/5 border-border hover:border-gold/30 text-body'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar Badge */}
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-black shrink-0 border ${
                            c.is_group
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              : c.role === 'ceo'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : c.role === 'doctor'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          }`}
                        >
                          {c.is_group ? '📢' : c.name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-xs text-body group-hover:text-gold transition-colors truncate">
                              {c.name}
                            </h4>
                            {getRoleBadge(c.role)}
                          </div>

                          {/* Mutaxassislik / bo'lim — har doim ko'rinadi */}
                          <p className="text-[10px] text-muted truncate mt-0.5 font-medium">
                            {c.specialization || 'Xodim profili'}
                          </p>
                          {/* Oxirgi xabar namunasi — alohida qatorda */}
                          <p className="text-[11px] truncate mt-0.5 font-medium">
                            {c.last_message && c.last_message !== "Xabarlar yo'q" ? (
                              <span className="text-body font-semibold">💬 {c.last_message}</span>
                            ) : (
                              <span className="text-muted italic">Xabarlar yo'q</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        {c.last_time && (
                          <span className="text-[10px] text-muted font-mono">
                            {c.last_time.split('T')[1]?.substring(0, 5)}
                          </span>
                        )}
                        {c.unread_count > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black animate-bounce shadow-md">
                            {c.unread_count} yangi
                          </span>
                        )}
                        {/* Ilgari bu faqat sichqoncha ustiga borganda
                            ko'rinardi — sensorli ekranda "hover" bo'lmagani
                            uchun tugma umuman chiqmasdi. Endi doim turadi. */}
                        <span className="text-[10px] text-gold font-bold whitespace-nowrap">
                          Yozish 💬 ➔
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── ACTIVE PERSON CHAT SCREEN (Shown when profile selected) ── */}
        {selectedChannel && (
          <div className="flex-1 flex flex-col min-w-0 bg-surface">

            {/* Active Profile Info Subheader */}
            <div className="p-3 border-b border-border bg-surface-2 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black border ${
                    selectedChannel.is_group
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : selectedChannel.role === 'ceo'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : selectedChannel.role === 'doctor'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  }`}
                >
                  {selectedChannel.is_group ? '📢' : selectedChannel.name?.charAt(0)}
                </div>

                <div>
                  <h4 className="font-extrabold text-xs text-body flex items-center gap-2">
                    <span>{selectedChannel.name}</span>
                    {getRoleBadge(selectedChannel.role)}
                  </h4>
                  <p className="text-[10px] text-muted font-semibold mt-0.5">
                    {selectedChannel.specialization || 'Jonli chat muloqoti'}
                  </p>
                </div>
              </div>

              {/* Back to Profiles Button (Always visible on chat view) */}
              <button
                onClick={() => setSelectedChannel(null)}
                className="px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Boshqa profilni tanlash</span>
              </button>
            </div>

            {/* Messages Flow */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs bg-surface-2/40">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted italic text-center p-6">
                  {selectedChannel.name} bilan hali muloqot xabarlari yo'q.<br />Birinchi xabaringizni pastda yozib yuboring! 💬
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === userId
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-bold text-muted">
                          {m.sender_name}
                        </span>
                        {getRoleBadge(m.sender_role)}
                      </div>

                      <div
                        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMe
                            ? 'bg-gradient-to-r from-gold to-amber-600 text-surface-dark font-bold rounded-br-none'
                            : 'bg-surface border border-border text-body rounded-bl-none font-semibold'
                        }`}
                      >
                        {m.content}
                      </div>

                      <div className="flex items-center gap-1 mt-1 px-1 font-mono text-[9px] text-muted">
                        <span>
                          {m.created_at ? new Date(m.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {isMe && <CheckCheck className="h-3 w-3 text-gold" />}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-border bg-surface flex gap-2 items-center shrink-0"
            >
              <input
                type="text"
                className="input-field flex-1 text-xs py-2.5 font-semibold bg-surface-2"
                placeholder={`${selectedChannel.name}ga xabar yozing...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
              />
              <Btn
                type="submit"
                variant="gold"
                size="sm"
                icon={<Send className="h-4 w-4" />}
                disabled={sending || !input.trim()}
                loading={sending}
              >
                Yuborish
              </Btn>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
