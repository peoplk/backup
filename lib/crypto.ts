'use client'

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 16

async function getPasswordKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(password)
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
}

async function deriveKey(passwordKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptData(data: string, password: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)

    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    const passwordKey = await getPasswordKey(password)
    const key = await deriveKey(passwordKey, salt)

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      dataBuffer
    )

    const encryptedArray = new Uint8Array(encryptedBuffer)
    const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + encryptedArray.length)
    result.set(salt, 0)
    result.set(iv, SALT_LENGTH)
    result.set(encryptedArray, SALT_LENGTH + IV_LENGTH)

    return btoa(String.fromCharCode(...result))
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('加密失败')
  }
}

export async function decryptData(encryptedData: string, password: string): Promise<string> {
  try {
    const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))

    if (encryptedBuffer.length < SALT_LENGTH + IV_LENGTH) {
      throw new Error('Invalid encrypted data')
    }

    const salt = encryptedBuffer.slice(0, SALT_LENGTH)
    const iv = encryptedBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const data = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH)

    const passwordKey = await getPasswordKey(password)
    const key = await deriveKey(passwordKey, salt)

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('解密失败，请检查密码是否正确')
  }
}

export function generateRandomPassword(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => chars[byte % chars.length]).join('')
}

const PBKDF2_ITERATIONS = 210000

async function pbkdf2Hash(password: string, salt: Uint8Array): Promise<string> {
  const passwordKey = await getPasswordKey(password)
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  )
  const hashArray = Array.from(new Uint8Array(derived))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = await pbkdf2Hash(password, salt)
  return `pbkdf2:${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length === 3 && parts[0] === 'pbkdf2') {
    const saltHex = parts[1]
    const hashHex = parts[2]
    const salt = Uint8Array.from(saltHex.match(/.{2}/g)?.map(h => parseInt(h, 16)) ?? [])
    const computedHash = await pbkdf2Hash(password, salt)
    return computedHash === hashHex
  }
  // 兼容旧版 SHA-256 格式（salt:hash）
  const colonIndex = stored.indexOf(':')
  if (colonIndex === -1) return false
  const saltHex = stored.slice(0, colonIndex)
  const hashHex = stored.slice(colonIndex + 1)
  const encoder = new TextEncoder()
  const data = encoder.encode(saltHex + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return computedHash === hashHex
}
