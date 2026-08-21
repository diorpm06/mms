import { useEffect, useState, useRef } from 'react'
import { MessageSquare, Send, X, Search, Users, Shield, User, Maximize2, Minimize2, CheckCheck } from 'lucide-react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { playNotificationSound } from '../utils/sound'
import { Btn } from './UIKit'

export default function InternalChatModal({ open, onClose }) {
  const role = useAuthStore((s) => s.role)
  const fullName = useAuthStore((s) => s.fullName)
  const userId = useAuthStore((s) => s.userId)

  const [channels, setChannels] = useState([])
  const [selectedChannel, setSelectedChannel] = useState({ id: 'group', name: '📢 Umumiy Guruh (Barcha Xodimlar)', is_group: true })
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const messagesEndRef = useRef(null)
  const prevMsgCountRef = useRef(null)

  // Fetch channel list
  const loadChannels = async () => {
    try {
      const data = await api('/chat/channels')
      setChannels(data || [])
    } catch (e) {
      console.error('Error fetching chat channels:', e)
    }
  }

  // Fetch messages for currently selected channel
  const loadMessages = async (silent = false) => {
    if (!selectedChannel) return
    try {
      const recipientParam = selectedChannel.id === 'group' ? 'group' : selectedChannel.id
      const data = await api(`/chat/messages?recipient_id=${recipientParam}`)
      const newMsgs = data || []
      
      if (prevMsgCountRef.current !== null && newMsgs.length > prevMsgCountRef.current) {
        const last = newMsgs[newMsgs.length - 1]
        if (last && last.sender_id !== userId) {
          playNotificationSound('patient_added')
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
    loadChannels()
    loadMessages()
    const interval = setInterval(() => {
      loadChannels()
      loadMessages(true)
    }, 2500)
    return () => clearInterval(interval)
  }, [open, selectedChannel?.id])

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || sending) return
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
      setInput('')
      loadMessages(true)
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
    if (r === 'ceo') return <span className="badge badge-gold text-[9px] font-black">👑 CEO</span>
    if (r === 'doctor') return <span className="badge badge-emerald text-[9px] font-black">🩺 Shifokor</span>
    if (r === 'admin') return <span className="badge badge-cyan text-[9px] font-black">👤 Admin</span>
    return <span className="badge badge-purple text-[9px] font-black">📢 Guruh</span>
  }

  return (
    <div
      className={`fixed z-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in zoom-in-95 ${
        isExpanded
          ? 'inset-4 sm:inset-10 max-w-5xl mx-auto h-[calc(100vh-80px)]'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-full max-w-2xl h-[560px]'
      }`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 0 1px var(--border-strong)',
      }}
    >
      {/* ── TOP TELEGRAM HEADER ── */}
      <div
        className="px-4 py-3 text-white flex items-center justify-between shadow-md shrink-0 select-none"
        style={{ background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2 bg-white/10 text-white shadow-inner">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm leading-tight tracking-wide flex items-center gap-2">
              <span>Klinika Telegram Chat</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">Real-Time</span>
            </h3>
            <p className="text-[11px] text-cyan-100 opacity-95">
              Shifokorlar, Registratura (Admin) va CEO aloqa kanali
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-all"
            title={isExpanded ? 'Kichiklashtirish' : 'Kattalashtirish'}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-all"
            title="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── MAIN DUAL PANE CHAT BODY ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* ── LEFT SIDEBAR: CHANNELS & STAFF LIST ── */}
        <div className="w-64 sm:w-72 border-r border-border bg-surface-2 flex flex-col shrink-0">
          
          {/* Search bar */}
          <div className="p-2.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Chat yoki xodimni izlash..."
                className="input-field pl-9 py-1.5 text-xs font-semibold rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Channels & Users list */}
          <div className="flex-1 overflow-y-auto space-y-1 p-1.5">
            {filteredChannels.map((c) => {
              const isSelected = selectedChannel?.id === c.id
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChannel(c)}
                  className={`p-2.5 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-2.5 select-none ${
                    isSelected
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 font-bold shadow-sm'
                      : 'hover:bg-surface border border-transparent text-body'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${
                        c.is_group
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : c.role === 'ceo'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : c.role === 'doctor'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {c.is_group ? '📢' : c.name.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs truncate leading-tight">{c.name}</span>
                      </div>
                      <p className="text-[10px] text-muted truncate mt-0.5 font-medium">
                        {c.last_message || c.specialization}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    {c.last_time && (
                      <span className="text-[9px] text-muted font-mono">
                        {c.last_time.split('T')[1]?.substring(0, 5)}
                      </span>
                    )}
                    {c.unread_count > 0 && (
                      <span className="badge badge-danger text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full animate-bounce">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT PANE: ACTIVE MESSAGES & INPUT ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface">
          
          {/* Active Chat Header */}
          <div className="p-3 border-b border-border bg-surface-2 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                  selectedChannel?.is_group
                    ? 'bg-purple-500/20 text-purple-400'
                    : selectedChannel?.role === 'ceo'
                    ? 'bg-amber-500/20 text-amber-400'
                    : selectedChannel?.role === 'doctor'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-cyan-500/20 text-cyan-400'
                }`}
              >
                {selectedChannel?.is_group ? '📢' : selectedChannel?.name?.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-xs text-body flex items-center gap-2">
                  <span>{selectedChannel?.name}</span>
                  {getRoleBadge(selectedChannel?.role)}
                </h4>
                <p className="text-[10px] text-muted font-semibold mt-0.5">
                  {selectedChannel?.specialization || 'Faol aloqa kanali'}
                </p>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-surface-2/40">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted italic text-center p-6">
                Ushbu muloqotda hali xabarlar yo'q.<br />Birinchi xabaringizni yuboring! 💬
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === userId
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1 mb-0.5 px-1">
                      <span className="text-[10px] font-bold text-muted">
                        {m.sender_name}
                      </span>
                      {getRoleBadge(m.sender_role)}
                    </div>

                    <div
                      className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs font-medium shadow-md leading-relaxed ${
                        isMe
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none font-semibold'
                          : 'bg-surface border border-border text-body rounded-bl-none'
                      }`}
                    >
                      {m.content}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5 px-1 font-mono text-[9px] text-muted">
                      <span>
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {isMe && <CheckCheck className="h-3 w-3 text-cyan-400" />}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Input Bar */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-border bg-surface flex gap-2 items-center shrink-0"
          >
            <input
              type="text"
              className="input-field flex-1 text-xs py-2.5 font-semibold"
              placeholder={`${selectedChannel?.name || 'Chat'}ga xabar yozing...`}
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

      </div>
    </div>
  )
}
