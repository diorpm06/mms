const DB_NAME = 'marjona_med_offline'
const STORE = 'pending_patients'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePendingPatient(data) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ ...data, createdAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingPatients() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function removePendingPatient(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

let _syncing = false

export async function syncPending(apiFn) {
  // Ikkita chaqiruv (masalan 'online' hodisasi va ilova ochilishi) bir vaqtda
  // ishga tushib, bitta bemorni ikki marta yubormasin.
  if (_syncing || !navigator.onLine) return
  const pending = await getPendingPatients()
  if (pending.length === 0) return

  _syncing = true
  let success = 0
  let failed = 0
  try {
    for (const item of pending) {
      try {
        await apiFn('/patients', { method: 'POST', body: JSON.stringify(item.payload) })
        await removePendingPatient(item.id)
        success += 1
      } catch (e) {
        // 4xx (masalan noto'g'ri ma'lumot) qayta urinsa ham tuzalmaydi —
        // navbatda abadiy qolib, keyingi bemorlarni ham yuborilishini
        // to'sib qo'ymasin, shuning uchun olib tashlaymiz. Tarmoq/server
        // xatosi (5xx yoki status yo'q) bo'lsa — keyingi safar qayta
        // urinish uchun navbatda qoldiramiz.
        const status = e?.status
        console.warn('Offline bemorni yuborishda xato:', e)
        if (typeof status === 'number' && status >= 400 && status < 500) {
          await removePendingPatient(item.id)
        }
        failed += 1
      }
    }
  } finally {
    _syncing = false
  }

  if (success > 0 || failed > 0) {
    import('../store/toastStore').then(({ useToastStore }) => {
      const add = useToastStore.getState().add
      if (success > 0) add(`${success} ta offline saqlangan bemor serverga yuborildi ✓`, 'success')
      if (failed > 0) add(`${failed} ta offline bemor hali yuborilmadi — qayta urinib ko'riladi`, 'error')
    })
  }
}

// Ilova ochilganda (agar internet bo'lsa — oldingi seansdan qolgan
// bemorlar bo'lishi mumkin) va internet qaytganda navbatdagi bemorlarni
// avtomatik yuboradi. Service worker'ni O'ZI RO'YXATDAN O'TKAZMAYDI —
// buni `main.jsx` `virtual:pwa-register` orqali alohida qiladi, bu yerda
// takror ro'yxatga olinsa ikkita worker bir-biriga xalaqit berishi mumkin.
export function initOfflineSync() {
  import('./api').then(({ api }) => {
    syncPending(api)
    window.addEventListener('online', () => syncPending(api))
  })
}
