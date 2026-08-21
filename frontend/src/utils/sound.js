// Web Audio API Sound Notifications (Chimes, Melodies & Chat Pops)
let sharedAudioCtx = null

function getAudioCtx() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass()
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
  } catch (_) {
    return null
  }
}

// Global user gesture listener to unlock browser audio context on first interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioCtx()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  }
  window.addEventListener('click', unlockAudio, { passive: true })
  window.addEventListener('touchstart', unlockAudio, { passive: true })
  window.addEventListener('keydown', unlockAudio, { passive: true })
}

// Chat ovozi ikki joydan chalinishi mumkin: ochiq chat oynasidan va
// yon paneldagi umumiy tekshiruvdan. Ikkalasi bir vaqtda chalmasligi
// uchun oxirgi chalingan vaqt shu yerda eslab qolinadi.
let oxirgiChatOvozi = 0

export function chatOvoziEndiginaChalindi(ms = 3500) {
  return Date.now() - oxirgiChatOvozi < ms
}

export function playNotificationSound(type = 'patient_added') {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    // Faqat KELGAN xabar ovozi belgilanadi. O'zim yuborganimda o'qilmagan
    // sanog'im oshmaydi, ya'ni ikkilanish xavfi yo'q.
    if (type === 'chat_receive' || type === 'chat_message') {
      oxirgiChatOvozi = Date.now()
    }

    const now = ctx.currentTime

    if (type === 'patient_added' || type === 'shablon_received') {
      // Double chime (C5 -> G5) for new patient or new template submission
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(523.25, now)
      gain1.gain.setValueAtTime(0.35, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.35)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(783.99, now + 0.15)
      gain2.gain.setValueAtTime(0.4, now + 0.15)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.15)
      osc2.stop(now + 0.6)
    } else if (type === 'doctor_submit') {
      // Tri-tone melody (E5 -> G5 -> C6) when doctor submits template to admin
      const notes = [659.25, 783.99, 1046.50]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.12)
        gain.gain.setValueAtTime(0.35, now + idx * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.12)
        osc.stop(now + idx * 0.12 + 0.4)
      })
    } else if (type === 'chat_send' || type === 'chat_receive' || type === 'chat_message') {
      // Pleasant Telegram-like double pop (A5 -> E6)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now)
      gain1.gain.setValueAtTime(0.3, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.12)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1318.5, now + 0.07)
      gain2.gain.setValueAtTime(0.35, now + 0.07)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.07)
      osc2.stop(now + 0.28)
    }
  } catch (err) {
    console.error('Audio play error:', err)
  }
}
