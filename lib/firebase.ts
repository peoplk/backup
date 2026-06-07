import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Timestamp,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth'

const FIREBASE_CONFIG_KEY = 'focusflow-firebase-config'

export interface FirebaseConfigInput {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

function loadStoredConfig(): FirebaseConfigInput | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(FIREBASE_CONFIG_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return null
}

function buildConfig(): FirebaseConfigInput | null {
  const stored = loadStoredConfig()
  if (stored) return stored

  const envConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig as FirebaseConfigInput
  }
  return null
}

let app: FirebaseApp | null = null
let db: ReturnType<typeof getFirestore> | null = null
let auth: ReturnType<typeof getAuth> | null = null
let currentConfig: FirebaseConfigInput | null = null

function initFirebase(config: FirebaseConfigInput): boolean {
  try {
    if (app) {
      try { getApp() } catch { /* app was deleted */ }
    }
    app = getApps().length === 0 ? initializeApp(config) : getApp()
    db = getFirestore(app)
    auth = getAuth(app)
    currentConfig = config
    return true
  } catch (err) {
    console.warn('Firebase initialization failed', err)
    app = null
    db = null
    auth = null
    currentConfig = null
    return false
  }
}

function tryInitFromStorageOrEnv(): boolean {
  const config = buildConfig()
  if (!config) return false
  return initFirebase(config)
}

tryInitFromStorageOrEnv()

export function getIsFirebaseConfigured(): boolean {
  return !!currentConfig && !!app && !!db && !!auth
}

export function getFirebaseConfig(): FirebaseConfigInput | null {
  return currentConfig ? { ...currentConfig } : null
}

export function saveFirebaseConfig(config: FirebaseConfigInput): boolean {
  if (!config.apiKey || !config.projectId) return false
  if (typeof window !== 'undefined') {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config))
  }
  return initFirebase(config)
}

export function clearFirebaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(FIREBASE_CONFIG_KEY)
  }
  currentConfig = null
}

export function reinitializeFirebase(): boolean {
  return tryInitFromStorageOrEnv()
}

export { db, auth }

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncAt: Date | null
  error: string | null
  userId: string | null
  isEnabled: boolean
}

let syncStatusCallback: ((status: SyncState) => void) | null = null

export function setSyncStatusCallback(callback: (status: SyncState) => void) {
  syncStatusCallback = callback
}

function notifyStatus(status: SyncState) {
  syncStatusCallback?.(status)
}

function datesToTimestamps(obj: unknown): unknown {
  if (obj instanceof Date) {
    return Timestamp.fromDate(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(datesToTimestamps)
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = datesToTimestamps(value)
    }
    return result
  }
  return obj
}

function timestampsToDates(obj: unknown): unknown {
  if (obj instanceof Timestamp) {
    return obj.toDate()
  }
  if (Array.isArray(obj)) {
    return obj.map(timestampsToDates)
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = timestampsToDates(value)
    }
    return result
  }
  return obj
}

export async function ensureAuth(): Promise<string | null> {
  if (!auth || !getIsFirebaseConfigured()) return null
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth!, (user) => {
      unsubscribe()
      if (user) {
        resolve(user.uid)
      } else {
        signInAnonymously(auth!)
          .then((cred) => resolve(cred.user.uid))
          .catch(() => resolve(null))
      }
    })
  })
}

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle(): Promise<User | null> {
  if (!auth || !getIsFirebaseConfigured()) return null
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google 登录失败'
    notifyStatus({ status: 'error', lastSyncAt: null, error: message, userId: null, isEnabled: false })
    return null
  }
}

export async function signOutAuth(): Promise<void> {
  if (!auth) return
  await signOut(auth)
}

export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null
}

export function isGoogleUser(): boolean {
  const user = auth?.currentUser
  if (!user) return false
  return user.providerData.some(p => p.providerId === 'google.com')
}

export async function syncToCloud(userId: string, data: Record<string, unknown>): Promise<void> {
  if (!db || !getIsFirebaseConfigured()) return
  notifyStatus({ status: 'syncing', lastSyncAt: null, error: null, userId, isEnabled: true })
  try {
    const userDoc = doc(db, 'users', userId)
    const serialized = datesToTimestamps(data)
    await setDoc(userDoc, {
      data: serialized,
      updatedAt: Timestamp.now(),
    })
    notifyStatus({ status: 'synced', lastSyncAt: new Date(), error: null, userId, isEnabled: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : '同步失败'
    notifyStatus({ status: 'error', lastSyncAt: null, error: message, userId, isEnabled: true })
    throw err
  }
}

export async function syncFromCloud(userId: string): Promise<Record<string, unknown> | null> {
  if (!db || !getIsFirebaseConfigured()) return null
  const userDoc = doc(db, 'users', userId)
  const snap = await getDoc(userDoc)
  if (!snap.exists()) return null
  const raw = snap.data().data as Record<string, unknown>
  return timestampsToDates(raw) as Record<string, unknown>
}

export function subscribeToCloud(
  userId: string,
  onData: (data: Record<string, unknown>) => void
): () => void {
  if (!db || !getIsFirebaseConfigured()) return () => {}
  const userDoc = doc(db, 'users', userId)
  return onSnapshot(
    userDoc,
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data().data as Record<string, unknown>
        onData(timestampsToDates(raw) as Record<string, unknown>)
      }
    },
    (err) => {
      notifyStatus({
        status: 'error',
        lastSyncAt: null,
        error: err.message,
        userId,
        isEnabled: true,
      })
    }
  )
}

export async function setOfflineMode(offline: boolean): Promise<void> {
  if (!db) return
  if (offline) {
    await disableNetwork(db)
    notifyStatus({ status: 'offline', lastSyncAt: null, error: null, userId: null, isEnabled: false })
  } else {
    await enableNetwork(db)
  }
}

export async function mergeLocalAndCloud(
  userId: string,
  localData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const cloudData = await syncFromCloud(userId)
  if (!cloudData) {
    await syncToCloud(userId, localData)
    return localData
  }

  const merged: Record<string, unknown> = { ...cloudData }
  for (const key of Object.keys(localData)) {
    const localValue = localData[key]
    const cloudValue = cloudData[key]

    if (Array.isArray(localValue) && Array.isArray(cloudValue)) {
      const localMap = new Map((localValue as Array<{ id: string; updatedAt?: Date }>).map((item) => [item.id, item]))
      const cloudMap = new Map((cloudValue as Array<{ id: string; updatedAt?: Date }>).map((item) => [item.id, item]))
      const mergedMap = new Map(cloudMap)

      for (const [id, localItem] of localMap) {
        const cloudItem = cloudMap.get(id)
        if (!cloudItem) {
          mergedMap.set(id, localItem)
        } else {
          const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0
          const cloudTime = (cloudItem as { updatedAt?: Date }).updatedAt
            ? new Date((cloudItem as { updatedAt?: Date }).updatedAt!).getTime()
            : 0
          if (localTime > cloudTime) {
            mergedMap.set(id, localItem)
          }
        }
      }

      merged[key] = Array.from(mergedMap.values())
    } else {
      merged[key] = localValue !== undefined ? localValue : cloudValue
    }
  }

  await syncToCloud(userId, merged)
  return merged
}
