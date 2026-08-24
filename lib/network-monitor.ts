import { setOfflineMode } from './firebase'
import { useSyncStore } from './sync-store'
import { useS3SyncStore } from './s3-store'

let initialized = false

export function initNetworkMonitor(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  const handleOffline = () => {
    setOfflineMode(true)
    useSyncStore.setState({ status: 'offline' })
    useS3SyncStore.setState({ status: 'offline' })
  }

  const handleOnline = () => {
    setOfflineMode(false)
    useSyncStore.setState({ status: 'idle' })
    useS3SyncStore.setState({ status: 'idle' })
  }

  window.addEventListener('offline', handleOffline)
  window.addEventListener('online', handleOnline)
}
