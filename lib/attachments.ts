import type { AttachmentMeta } from '@/lib/types'

/**
 * 任务附件二进制存储：IndexedDB（不进 zustand persist，避免撑爆 localStorage 配额）。
 * 元数据挂在 Task.attachments 上，随 JSON 备份导出；文件本体仅存本机。
 */

const DB_NAME = 'focusflow-attachments'
const DB_VERSION = 1
const STORE_NAME = 'blobs'

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE_NAME, mode)
        const req = run(t.objectStore(STORE_NAME))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
  )
}

export function makeAttachmentMeta(file: File): AttachmentMeta {
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString(),
  }
}

export async function saveAttachmentBlob(attachmentId: string, blob: Blob): Promise<void> {
  await tx('readwrite', (store) => store.put(blob, attachmentId) as IDBRequest<IDBValidKey>)
}

export async function getAttachmentBlob(attachmentId: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>('readonly', (store) => store.get(attachmentId) as IDBRequest<Blob | undefined>)
}

export async function deleteAttachmentBlob(attachmentId: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(attachmentId) as IDBRequest<undefined>)
}

/** 用 Blob 触发浏览器/Electron 的另存为下载 */
export function downloadAttachment(meta: AttachmentMeta, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = meta.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function openAttachment(meta: AttachmentMeta, blob: Blob): Promise<void> {
  // 优先系统级打开（Electron 主进程 shell.openPath：先落临时文件）
  if (window.electronAPI?.openAttachment) {
    const buf = await blob.arrayBuffer()
    const res = await window.electronAPI.openAttachment(meta.name, buf)
    if (!res.ok) throw new Error(res.error || '打开附件失败')
    return
  }
  downloadAttachment(meta, blob)
}

/** 任务删除时清理其全部附件二进制（best-effort） */
export function deleteTaskAttachments(attachments?: AttachmentMeta[]): void {
  if (!attachments?.length) return
  Promise.all(attachments.map((a) => deleteAttachmentBlob(a.id).catch(() => undefined))).catch(() => undefined)
}
