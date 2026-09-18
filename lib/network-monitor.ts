import { useS3SyncStore } from './s3-store'

let initialized = false

export function initNetworkMonitor(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  const handleOffline = () => {
    useS3SyncStore.setState({ status: 'offline' })
  }

  const handleOnline = () => {
    useS3SyncStore.setState({ status: 'idle' })
  }

  window.addEventListener('offline', handleOffline)
  window.addEventListener('online', handleOnline)
}
