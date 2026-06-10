'use client'

/**
 * Firebase 同步配置面板（移动端专用）
 *
 * 设计语言与 sync-s3-pane.tsx / sync-webdav-pane.tsx 完全一致：
 * - Section: 分组标题 + rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/20
 * - Row: 图标(18px muted) + 标签(13px) + 右侧控件
 * - 输入框: h-11 rounded-2xl
 * - 按钮: rounded-2xl, active:scale-[0.98]
 * - 字体: [10px]-[13px]
 */

import { memo, useCallback, useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Loader2,
  Check,
  Globe,
  Flame,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  getIsFirebaseConfigured,
  getFirebaseConfig,
  saveFirebaseConfig,
  ensureAuth as ensureFirebaseAuth,
  syncToCloud,
  syncFromCloud,
  getCurrentUser,
  isGoogleUser,
  signInWithGoogle,
  signOutAuth,
  type FirebaseConfigInput,
} from '@/lib/firebase'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { restoreDataToStore } from '@/lib/data-restore'

interface FirebasePaneProps {
  syncEnabled: boolean
  onSyncEnabledChange: (v: boolean) => void
  lastSyncAt: Date | null
  onSynced: (date: Date) => void
  onClose: () => void
}

function FirebasePaneInner({
  syncEnabled,
  onSyncEnabledChange,
  lastSyncAt,
  onSynced,
  onClose,
}: FirebasePaneProps) {
  const storeData = useAppStore(useShallow(state => ({
    tasks: state.tasks,
    habits: state.habits,
    habitCheckIns: state.habitCheckIns,
    goals: state.goals,
    anniversaries: state.anniversaries,
    projects: state.projects,
    pomodoroSessions: state.pomodoroSessions,
    tags: state.tags,
  })))

  const [config, setConfig] = useState<FirebaseConfigInput>(() => {
    if (typeof window === 'undefined') {
      return { apiKey: '', authDomain: '', projectId: '' }
    }
    const stored = getFirebaseConfig()
    return stored ?? { apiKey: '', authDomain: '', projectId: '' }
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfigured, setIsConfigured] = useState(() => getIsFirebaseConfigured())
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(() => isGoogleUser())

  const updateField = useCallback(<K extends keyof FirebaseConfigInput>(key: K, value: FirebaseConfigInput[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(() => {
    setIsSaving(true)
    try {
      const ok = saveFirebaseConfig(config)
      if (ok) {
        setIsConfigured(true)
        setTestResult({ success: true, message: '配置已保存，Firebase 已初始化' })
        toast.success('Firebase 配置已保存')
      } else {
        toast.error('保存失败：请检查必填项（API Key、Auth Domain、Project ID）')
      }
    } finally {
      setIsSaving(false)
    }
  }, [config])

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const user = await signInWithGoogle()
      if (user) {
        setIsGoogleSignedIn(true)
        toast.success(`已登录：${user.email || user.displayName || 'Google 用户'}`)
      } else {
        toast.error('Google 登录失败')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google 登录失败'
      toast.error(message)
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      await signOutAuth()
      setIsGoogleSignedIn(false)
      toast.success('已退出登录')
    } catch {
      toast.error('退出登录失败')
    }
  }, [])

  const handlePush = useCallback(async () => {
    if (!getIsFirebaseConfigured()) {
      toast.error('请先保存 Firebase 配置')
      return
    }
    setIsSyncing(true)
    try {
      const userId = await ensureFirebaseAuth()
      if (!userId) {
        toast.error('认证失败，请检查配置')
        return
      }
      const data: Record<string, unknown> = {
        tasks: storeData.tasks,
        habits: storeData.habits,
        habitCheckIns: storeData.habitCheckIns,
        goals: storeData.goals,
        anniversaries: storeData.anniversaries,
        projects: storeData.projects,
        pomodoroSessions: storeData.pomodoroSessions,
        tags: storeData.tags,
        updatedAt: new Date().toISOString(),
      }
      await syncToCloud(userId, data)
      const now = new Date()
      onSynced(now)
      toast.success('已推送数据到 Firebase')
    } catch (err) {
      const message = err instanceof Error ? err.message : '推送失败'
      toast.error(message)
    } finally {
      setIsSyncing(false)
    }
  }, [storeData, onSynced])

  const handlePull = useCallback(async () => {
    if (!getIsFirebaseConfigured()) {
      toast.error('请先保存 Firebase 配置')
      return
    }
    setIsSyncing(true)
    try {
      const userId = await ensureFirebaseAuth()
      if (!userId) {
        toast.error('认证失败，请检查配置')
        return
      }
      const data = await syncFromCloud(userId)
      if (!data) {
        toast.info('远端暂无数据')
        return
      }
      const counts = restoreDataToStore(data)
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      const now = new Date()
      onSynced(now)
      if (total > 0) {
        toast.success(`已拉取 ${total} 条数据`)
      } else {
        toast.success('已拉取数据，但未发现新记录')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '拉取失败'
      toast.error(message)
    } finally {
      setIsSyncing(false)
    }
  }, [onSynced])

  const handleSwitchChange = useCallback((v: boolean) => {
    if (v && !isConfigured) {
      toast.error('请先填写并保存 Firebase 配置')
      return
    }
    onSyncEnabledChange(v)
  }, [isConfigured, onSyncEnabledChange])

  const currentUser = getCurrentUser()

  // Section 组件
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      {title && <p className="text-xs text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">{title}</p>}
      <div className="rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </div>
  )

  // Row 组件
  const Row = ({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
      <span className="flex-1 text-[13px]">{label}</span>
      {children}
    </div>
  )

  return (
    <div className="space-y-1 pt-2">
      {/* 状态开关 */}
      <Section title="">
        <Row icon={Globe} label="启用同步">
          <Switch
            checked={syncEnabled && isConfigured}
            onCheckedChange={handleSwitchChange}
            disabled={!isConfigured}
          />
        </Row>
      </Section>

      {/* 测试结果 */}
      {testResult && (
        <div
          className={cn(
            'mb-4 flex items-start gap-2 rounded-2xl p-3',
            testResult.success ? 'bg-chart-2/10' : 'bg-destructive/10'
          )}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          )}
          <p className={cn('text-xs', testResult.success ? 'text-chart-2' : 'text-destructive')}>
            {testResult.message}
          </p>
        </div>
      )}

      {/* Firebase 配置 */}
      <Section title="Firebase 配置">
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">API Key *</label>
          <Input
            placeholder="AIzaSy..."
            value={config.apiKey}
            onChange={(e) => updateField('apiKey', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Auth Domain *</label>
          <Input
            placeholder="your-project.firebaseapp.com"
            value={config.authDomain}
            onChange={(e) => updateField('authDomain', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Project ID *</label>
          <Input
            placeholder="your-project-id"
            value={config.projectId}
            onChange={(e) => updateField('projectId', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Storage Bucket</label>
          <Input
            placeholder="your-project.appspot.com"
            value={config.storageBucket ?? ''}
            onChange={(e) => updateField('storageBucket', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Messaging Sender ID</label>
          <Input
            placeholder="123456789"
            value={config.messagingSenderId ?? ''}
            onChange={(e) => updateField('messagingSenderId', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">App ID</label>
          <Input
            placeholder="1:123456789:web:abc123"
            value={config.appId ?? ''}
            onChange={(e) => updateField('appId', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
      </Section>

      {/* 保存配置按钮 */}
      <div className="space-y-2 px-1">
        <button
          className={cn(
            'w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-[13px] font-medium transition-all active:scale-[0.98]',
            isSaving || !config.apiKey?.trim() || !config.authDomain?.trim() || !config.projectId?.trim()
              ? 'bg-muted/30 text-muted-foreground'
              : 'bg-primary text-primary-foreground'
          )}
          onClick={handleSave}
          disabled={isSaving || !config.apiKey?.trim() || !config.authDomain?.trim() || !config.projectId?.trim()}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* 账号信息 */}
      {isConfigured && (
        <Section title="账号">
          {currentUser ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3">
                <User className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate">{currentUser.email || currentUser.displayName || '已登录用户'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {isGoogleSignedIn ? 'Google 账号' : '匿名账号'}
                  </p>
                </div>
              </div>
              {!isGoogleSignedIn && (
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-primary active:bg-primary/5 transition-colors"
                  onClick={handleGoogleSignIn}
                >
                  <Flame className="h-4 w-4" />
                  关联 Google 账号
                </button>
              )}
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] text-red-500 active:bg-red-500/5 transition-colors"
                onClick={handleSignOut}
              >
                退出登录
              </button>
            </>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-primary active:bg-primary/5 transition-colors"
              onClick={handleGoogleSignIn}
            >
              <Flame className="h-4 w-4" />
              Google 登录
            </button>
          )}
        </Section>
      )}

      {/* 上次同步时间 */}
      {lastSyncAt && isConfigured && (
        <p className="text-[11px] text-muted-foreground px-1 text-center">
          上次同步：{lastSyncAt.toLocaleString('zh-CN')}
        </p>
      )}

      {/* 推送/拉取 */}
      {isConfigured && (
        <div className="grid grid-cols-2 gap-2 px-1">
          <button
            className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-muted/30 text-[13px] font-medium active:bg-muted/50 transition-colors active:scale-[0.98]"
            onClick={handlePull}
            disabled={isSyncing}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            拉取
          </button>
          <button
            className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-primary text-primary-foreground text-[13px] font-medium active:scale-[0.98] transition-all"
            onClick={handlePush}
            disabled={isSyncing}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            推送
          </button>
        </div>
      )}

      {/* 提示信息 */}
      <div className="rounded-2xl bg-muted/30 p-3 mx-1">
        <p className="text-[11px] text-muted-foreground">
          配置信息来自 Firebase 控制台 → 项目设置 → 常规 → 您的应用 → SDK 设置和配置。支持匿名登录和 Google 登录，Firestore 实时同步。
        </p>
      </div>

      {/* 关闭按钮 */}
      <button
        className="w-full flex items-center justify-center h-11 rounded-2xl text-[13px] text-muted-foreground active:bg-muted/30 transition-colors active:scale-[0.98]"
        onClick={onClose}
      >
        关闭
      </button>
    </div>
  )
}

export const FirebasePane = memo(FirebasePaneInner)
