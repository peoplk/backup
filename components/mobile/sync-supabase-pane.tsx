'use client'

/**
 * Supabase 同步配置面板（移动端专用）
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
  Database,
  Mail,
  Lock,
  UserPlus,
  LogIn,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  getIsSupabaseConfigured,
  getSupabaseConfig,
  saveSupabaseConfig,
  ensureSupabaseAuth,
  syncToSupabase,
  syncFromSupabase,
  signInWithSupabaseEmail,
  signUpWithSupabaseEmail,
  signOutSupabase,
  type SupabaseConfigInput,
} from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { restoreDataToStore } from '@/lib/data-restore'

interface SupabasePaneProps {
  syncEnabled: boolean
  onSyncEnabledChange: (v: boolean) => void
  lastSyncAt: Date | null
  onSynced: (date: Date) => void
  onClose: () => void
}

function SupabasePaneInner({
  syncEnabled,
  onSyncEnabledChange,
  lastSyncAt,
  onSynced,
  onClose,
}: SupabasePaneProps) {
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

  const [config, setConfig] = useState<SupabaseConfigInput>(() => {
    if (typeof window === 'undefined') {
      return { url: '', anonKey: '' }
    }
    const stored = getSupabaseConfig()
    return stored ?? { url: '', anonKey: '' }
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfigured, setIsConfigured] = useState(() => getIsSupabaseConfigured())
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // 登录/注册
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [showAuthSection, setShowAuthSection] = useState(false)

  const updateField = useCallback(<K extends keyof SupabaseConfigInput>(key: K, value: SupabaseConfigInput[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(() => {
    setIsSaving(true)
    try {
      const ok = saveSupabaseConfig(config)
      if (ok) {
        setIsConfigured(true)
        setTestResult({ success: true, message: '配置已保存，Supabase 已初始化' })
        toast.success('Supabase 配置已保存')
      } else {
        toast.error('保存失败：请检查 URL 和 Anon Key')
      }
    } finally {
      setIsSaving(false)
    }
  }, [config])

  const handleAuth = useCallback(async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      toast.error('请填写邮箱和密码')
      return
    }
    setIsAuthLoading(true)
    try {
      const userId = authMode === 'login'
        ? await signInWithSupabaseEmail(authEmail, authPassword)
        : await signUpWithSupabaseEmail(authEmail, authPassword)

      if (userId) {
        toast.success(authMode === 'login' ? '登录成功' : '注册成功')
        setShowAuthSection(false)
      } else {
        toast.error(authMode === 'login' ? '登录失败' : '注册失败')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : (authMode === 'login' ? '登录失败' : '注册失败')
      toast.error(message)
    } finally {
      setIsAuthLoading(false)
    }
  }, [authEmail, authPassword, authMode])

  const handleSignOut = useCallback(async () => {
    try {
      await signOutSupabase()
      toast.success('已退出登录')
    } catch {
      toast.error('退出登录失败')
    }
  }, [])

  const handlePush = useCallback(async () => {
    if (!getIsSupabaseConfigured()) {
      toast.error('请先保存 Supabase 配置')
      return
    }
    setIsSyncing(true)
    try {
      const userId = await ensureSupabaseAuth()
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
      await syncToSupabase(userId, data)
      const now = new Date()
      onSynced(now)
      toast.success('已推送数据到 Supabase')
    } catch (err) {
      const message = err instanceof Error ? err.message : '推送失败'
      toast.error(message)
    } finally {
      setIsSyncing(false)
    }
  }, [storeData, onSynced])

  const handlePull = useCallback(async () => {
    if (!getIsSupabaseConfigured()) {
      toast.error('请先保存 Supabase 配置')
      return
    }
    setIsSyncing(true)
    try {
      const userId = await ensureSupabaseAuth()
      if (!userId) {
        toast.error('认证失败，请检查配置')
        return
      }
      const data = await syncFromSupabase(userId)
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
      toast.error('请先填写并保存 Supabase 配置')
      return
    }
    onSyncEnabledChange(v)
  }, [isConfigured, onSyncEnabledChange])

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

      {/* Supabase 配置 */}
      <Section title="Supabase 配置">
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Project URL *</label>
          <Input
            placeholder="https://your-project.supabase.co"
            value={config.url}
            onChange={(e) => updateField('url', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Anon Key *</label>
          <Input
            placeholder="eyJhbGciOiJIUzI1NiIs..."
            value={config.anonKey}
            onChange={(e) => updateField('anonKey', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">表名</label>
          <Input
            placeholder="focusflow_state"
            value={config.tableName ?? 'focusflow_state'}
            onChange={(e) => updateField('tableName', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
      </Section>

      {/* 保存配置按钮 */}
      <div className="space-y-2 px-1">
        <button
          className={cn(
            'w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-[13px] font-medium transition-all active:scale-[0.98]',
            isSaving || !config.url?.trim() || !config.anonKey?.trim()
              ? 'bg-muted/30 text-muted-foreground'
              : 'bg-primary text-primary-foreground'
          )}
          onClick={handleSave}
          disabled={isSaving || !config.url?.trim() || !config.anonKey?.trim()}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* 账号登录/注册 */}
      {isConfigured && (
        <Section title="账号">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 active:bg-muted/30 transition-colors text-left"
            onClick={() => setShowAuthSection(!showAuthSection)}
          >
            <Mail className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px]">邮箱登录</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                使用 Supabase 邮箱认证，或使用匿名模式
              </p>
            </div>
          </button>

          {showAuthSection && (
            <div className="px-4 py-3 space-y-3">
              {/* 登录/注册切换 */}
              <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5">
                <button
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all active:scale-95',
                    authMode === 'login' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  )}
                  onClick={() => setAuthMode('login')}
                >
                  登录
                </button>
                <button
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all active:scale-95',
                    authMode === 'register' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  )}
                  onClick={() => setAuthMode('register')}
                >
                  注册
                </button>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block">邮箱</label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="h-11 rounded-2xl"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block">密码</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="h-11 rounded-2xl"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              <button
                className={cn(
                  'w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-[13px] font-medium transition-all active:scale-[0.98]',
                  isAuthLoading ? 'bg-muted/30 text-muted-foreground' : 'bg-primary text-primary-foreground'
                )}
                onClick={handleAuth}
                disabled={isAuthLoading}
              >
                {isAuthLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : authMode === 'login' ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {isAuthLoading ? '处理中...' : authMode === 'login' ? '登录' : '注册'}
              </button>

              <button
                className="w-full flex items-center justify-center gap-2 h-9 rounded-2xl text-[12px] text-red-500 active:bg-red-500/5 transition-colors"
                onClick={handleSignOut}
              >
                退出登录
              </button>
            </div>
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
          配置信息来自 Supabase 控制台 → 项目设置 → API。支持邮箱密码登录和匿名模式，PostgreSQL + Realtime 实时同步。
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

export const SupabasePane = memo(SupabasePaneInner)
