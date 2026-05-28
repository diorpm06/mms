const RP_NAME = 'Marjona Med Servis'

function arrayToB64(arr) {
  return btoa(String.fromCharCode(...new Uint8Array(arr)))
}

function b64ToArray(b64) {
  const safe = b64.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(safe), (c) => c.charCodeAt(0))
}

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function hasBiometricRegistered() {
  return !!localStorage.getItem('mms_wa_id')
}

export async function registerBiometric(userId, displayName) {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const rpId = window.location.hostname

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME, id: rpId },
      user: {
        id: new TextEncoder().encode(String(userId)),
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })

  localStorage.setItem('mms_wa_id', arrayToB64(credential.rawId))
  return true
}

export async function verifyBiometric() {
  const idB64 = localStorage.getItem('mms_wa_id')
  if (!idB64) throw new Error("Biometrik ro'yxatdan o'tilmagan")

  const credId = b64ToArray(idB64)
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const rpId = window.location.hostname

  await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId,
      allowCredentials: [{ type: 'public-key', id: credId, transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  })

  return true
}

export function removeBiometric() {
  localStorage.removeItem('mms_wa_id')
}
