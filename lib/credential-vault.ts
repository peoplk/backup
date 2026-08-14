'use client'

/**
 * 凭据安全存储（Credential Vault）
 *
 * 在 Electron 桌面端利用操作系统级 safeStorage（Windows DPAPI / macOS Keychain）
 * 对敏感字段（AccessKey Secret、LLM API Key 等）加密后再落盘 localStorage，
 * 避免明文暴露在本机磁盘上。
 *
 * 当运行环境不提供 safeStorage（纯浏览器构建）时优雅降级：字段保持原样存储，
 * 功能不受影响，但调用方可感知当前是否处于「加密存储」模式。
 */

const SEAL_PREFIX = 'seal:v1:'
const CLEAR_SENTINEL = 'plain:'

export interface CredentialVaultStatus {
  available: boolean
  engine: 'electron-safeStorage' | 'none'
}

function isSafeStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.electronAPI?.credentialEncrypt === 'function'
}

export function getCredentialVaultStatus(): CredentialVaultStatus {
  const available = isSafeStorageAvailable()
  return { available, engine: available ? 'electron-safeStorage' : 'none' }
}

/** 将明文字段加密为密封值（safeStorage 不可用时原样返回并标记 unsealed）。 */
export async function sealSecret(plaintext: string): Promise<string> {
  if (!plaintext) return ''
  if (isSafeStorageAvailable()) {
    try {
      const sealed = await window.electronAPI!.credentialEncrypt!(plaintext)
      return SEAL_PREFIX + sealed
    } catch {
      // safeStorage 失败时降级，返回明文并加标记
      return CLEAR_SENTINEL + plaintext
    }
  }
  return CLEAR_SENTINEL + plaintext
}

/** 将密封值还原为明文；输入非密封值时按原样返回。 */
export async function unsealSecret(stored: string): Promise<string> {
  if (!stored) return ''
  if (stored.startsWith(SEAL_PREFIX)) {
    if (isSafeStorageAvailable()) {
      try {
        const encrypted = stored.slice(SEAL_PREFIX.length)
        return await window.electronAPI!.credentialDecrypt!(encrypted)
      } catch {
        return ''
      }
    }
    // safeStorage 已不可用（如从其他设备迁移），无法解密
    return ''
  }
  if (stored.startsWith(CLEAR_SENTINEL)) {
    return stored.slice(CLEAR_SENTINEL.length)
  }
  // 兼容历史纯明文存储
  return stored
}

/** 判断一个值是否为仍在透明存储的敏感字段。 */
export function isSecretSealed(stored: string): boolean {
  return stored.startsWith(SEAL_PREFIX)
}