import { useEffect, useState, useRef } from 'react'
import { MessageSquare, Send, X } from 'lucide-react'
import { api } from '../utils/api'
import { useAuthStore } from '../store/authStore'
import { Btn, Icons } from './UIKit'

export default function InternalChatModal({ open, onClose }) {
  const role = useAuthStore((s) => s.role)
  const fullName = useAuthStore((s) => s.fullName)
  const userId = useAuthStore((s) => s.userId)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  const loadMessages = async () => {
    try {
      const data = await api('/chat/messages')
      setMessages(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!open) return
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [open])

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
      await api('/chat/send', {
        method: 'POST',
        body: JSON.stringify({ content: input }),
      })
      setInput('')
      loadMessages()
    } catch (e) {
      alert(e.message)
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[520px] animate-in fade-in zoom-in-95"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), 0 0 0 1px var(--border-strong)',
      }}
    >
      {/* Header */}
      <div
        className="p-4 text-white flex items-center justify-between shadow-md"
        style={{ background: 'linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl p-1.5 bg-white/10">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm leading-tight text-white">Klinika Ichki Chati</h3>
            <span className="text-[10px] text-cyan-100 opacity-90 block">Registratura, CEO va Shifokorlar</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-all"
          title="Yopish"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Area - SOLID OPAQUE BACKGROUND */}
      <div
        className="flex-1 p-4 overflow-y-auto space-y-3 text-xs"
        style={{ background: 'var(--surface-2)' }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted italic">
            Xabarlar yo'q. Birinchi xabarni yuboring!
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_name === fullName || m.sender_id === userId
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-muted mb-0.5 px-1 font-bold">
                  {m.sender_name} ({m.sender_role === 'ceo' ? '👑 CEO' : m.sender_role === 'doctor' ? '🩺 Shifokor' : '👤 Registratura'})
                </span>
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs font-medium shadow-md leading-relaxed ${
                    isMe
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none font-semibold'
                      : 'rounded-bl-none'
                  }`}
                  style={!isMe ? {
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text)',
                  } : {}}
                >
                  {m.content}
                </div>
                <span className="text-[9px] text-muted opacity-70 mt-0.5 px-1 font-mono">
                  {new Date(m.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send Input - SOLID OPAQUE BACKGROUND */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t flex gap-2"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <input
          type="text"
          className="input-field flex-1 text-xs py-2 font-medium"
          placeholder="Xabar yozing..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Btn
          type="submit"
          variant="gold"
          size="sm"
          icon={<Send className="h-4 w-4" />}
          disabled={sending || !input.trim()}
          loading={sending}
        />
      </form>
    </div>
  )
}
