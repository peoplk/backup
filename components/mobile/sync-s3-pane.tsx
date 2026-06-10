'use client'

/**
 * S3 兼容同步配置面板（移动端专用）
 *
 * 设计语言与 sync-webdav-pane.tsx 完全一致：
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
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Upload,
  Loader2,
  Check,
  ChevronDown,
  Server,
  Database,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  getIsS3Configured,
  getS3Config,
  saveS3Config,
  testS3Connection,
  ensureS3Auth,
  syncToS3,
  syncFromS3,
  S3_PRESET_SERVICES,
  type S3ConfigInput,
} from '@/lib/s3-sync'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { restoreDataToStore } from '@/lib/data-restore'

interface S3PaneProps {
  syncEnabled: boolean
  onSyncEnabledChange: (v: boolean) => void
  lastSyncAt: Date | null
  onSynced: (date: Date) => void
  onClose: () => void
}

function S3PaneInner({
  syncEnabled,
  onSyncEnabledChange,
  lastSyncAt,
  onSynced,
  onClose,
}: S3PaneProps) {
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

  const [config, setConfig] = useState<S3ConfigInput>(() => {
    if (typeof window === 'undefined') {
      return { endpoint: '', region: 'us-east-1', bucket: '', accessKeyId: '', secretAccessKey: '', forcePathStyle: true, remoteKey: 'focusflow-sync.json', syncInterval: 30 }
    }
    const stored = getS3Config()
    return stored ?? { endpoint: '', region: 'us-east-1', bucket: '', accessKeyId: '', secretAccessKey: '', forcePathStyle: true, remoteKey: 'focusflow-sync.json', syncInterval: 30 }
  })
  const [showSecret, setShowSecret] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfigured, setIsConfigured] = useState(() => getIsS3Configured())
  const [showPresetDropdown, setShowPresetDropdown] = useState(false)

  const updateField = useCallback(<K extends keyof S3ConfigInput>(key: K, value: S3ConfigInput[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handlePresetSelect = useCallback((preset: typeof S3_PRESET_SERVICES[number]) => {
    setConfig((prev) => ({
      ...prev,
      endpoint: preset.endpoint || prev.endpoint,
      region: preset.region || prev.region,
      forcePathStyle: preset.forcePathStyle,
    }))
    setShowPresetDropdown(false)
  }, [])

  const handleTest = useCallback(async () => {
    if (!config.endpoint?.trim()) {
      setTestResult({ success: false, message: '请填写 Endpoint' })
      toast.error('请填写 Endpoint')
      return
    }
    if (!config.bucket?.trim()) {
      setTestResult({ success: false, message: '请填写 Bucket' })
      toast.error('请填写 Bucket')
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testS3Connection(config)
      setTestResult(result)
      if (result.success) toast.success(result.message)
      else toast.error(result.message)
    } finally {
      setIsTesting(false)
    }
  }, [config])

  const handleSave = useCallback(() => {
    setIsSaving(true)
    try {
      const ok = saveS3Config(config)
      if (ok) {
        setIsConfigured(true)
        setTestResult({ success: true, message: '配置已保存' })
        toast.success('S3 配置已保存')
      } else {
        toast.error('保存失败：请检查必填项')
      }
    } finally {
      setIsSaving(false)
    }
  }, [config])

  const handlePush = useCallback(async () => {
    if (!getIsS3Configured()) {
      toast.error('请先保存 S3 配置')
      return
    }
    setIsSyncing(true)
    try {
      const userId = await ensureS3Auth()
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
      await syncToS3(userId, data)
      const now = new Date()
      onSynced(now)
      toast.success('已推送数据到 S3')
    } catch (err) {
      const message = err instanceof Error ? err.message : '推送失败'
      toast.error(message)
    } finally {
      setIsSyncing(false)
    }
  }, [storeData, onSynced])

  const handlePull = useCallback(async () => {
    if (!getIsS3Configured()) {
      toast.error('请先保存 S3 配置')
      return
    }
    setIsSyncing(true)
    try {
      const userId = await ensureS3Auth()
      if (!userId) {
        toast.error('认证失败，请检查配置')
        return
      }
      const data = await syncFromS3(userId)
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
      toast.error('请先填写并保存 S3 配置')
      return
    }
    onSyncEnabledChange(v)
  }, [isConfigured, onSyncEnabledChange])

  // 匹配当前配置的预设名
  const matchedPreset = S3_PRESET_SERVICES.find(p => p.endpoint === config.endpoint && p.region === config.region)
  const selectedPresetName = matchedPreset?.name ?? (config.endpoint ? '自定义 S3' : '选择服务')

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

      {/* 服务配置 */}
      <Section title="服务配置">
        {/* 预设选择 */}
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">S3 服务</label>
          <div className="relative">
            <button
              type="button"
              className="w-full flex items-center justify-between h-11 px-4 rounded-2xl bg-muted/30 border border-border/40 text-sm transition-all active:scale-[0.98]"
              onClick={() => setShowPresetDropdown(v => !v)}
            >
              <span className={cn(config.endpoint ? 'text-foreground' : 'text-muted-foreground')}>
                {selectedPresetName}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showPresetDropdown && 'rotate-180')} />
            </button>

            {showPresetDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPresetDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-2xl bg-popover border border-border shadow-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                  {S3_PRESET_SERVICES.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-accent',
                        config.endpoint === preset.endpoint && config.region === preset.region && 'bg-primary/5 text-primary'
                      )}
                      onClick={() => handlePresetSelect(preset)}
                    >
                      <div className="text-left">
                        <span>{preset.name}</span>
                        {preset.description && (
                          <span className="text-[11px] text-muted-foreground ml-2">{preset.description}</span>
                        )}
                      </div>
                      {!preset.endpoint && (
                        <span className="text-[11px] text-muted-foreground">（需手动填写）</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Endpoint */}
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Endpoint</label>
          <Input
            placeholder="https://oss-cn-hangzhou.aliyuncs.com"
            value={config.endpoint}
            onChange={(e) => updateField('endpoint', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        {/* Region */}
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Region</label>
          <Input
            placeholder="oss-cn-hangzhou"
            value={config.region}
            onChange={(e) => updateField('region', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        {/* Bucket */}
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">Bucket</label>
          <Input
            placeholder="my-bucket"
            value={config.bucket}
            onChange={(e) => updateField('bucket', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        {/* Path Style 开关 */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] text-muted-foreground block">Path Style 访问</label>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">阿里云 OSS / MinIO 需开启</p>
            </div>
            <Switch
              checked={config.forcePathStyle ?? true}
              onCheckedChange={(v) => updateField('forcePathStyle', v)}
            />
          </div>
        </div>
      </Section>

      {/* 凭证 */}
      <Section title="AccessKey">
        {/* AccessKey ID */}
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">AccessKey ID</label>
          <Input
            placeholder="LTAI5t..."
            autoComplete="username"
            value={config.accessKeyId}
            onChange={(e) => updateField('accessKeyId', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>

        {/* AccessKey Secret */}
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">AccessKey Secret</label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-11 rounded-2xl pr-10"
              value={config.secretAccessKey}
              onChange={(e) => updateField('secretAccessKey', e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
              onClick={() => setShowSecret((v) => !v)}
              aria-label={showSecret ? '隐藏密钥' : '显示密钥'}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </Section>

      {/* 高级配置 */}
      <Section title="高级">
        {/* 远端对象 Key */}
        <div className="px-4 py-3">
          <label className="text-[11px] text-muted-foreground mb-1.5 block">远端对象 Key</label>
          <Input
            placeholder="focusflow-sync.json"
            value={config.remoteKey ?? 'focusflow-sync.json'}
            onChange={(e) => updateField('remoteKey', e.target.value)}
            className="h-11 rounded-2xl"
          />
        </div>
      </Section>

      {/* 操作按钮 */}
      <div className="space-y-2 px-1">
        {/* 测试连接 */}
        <button
          className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-muted/30 text-[13px] font-medium active:bg-muted/50 transition-colors active:scale-[0.98]"
          onClick={handleTest}
          disabled={isTesting}
        >
          {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isTesting ? '测试中...' : '测试连接'}
        </button>

        {/* 保存配置 */}
        <button
          className={cn(
            'w-full flex items-center justify-center gap-2 h-11 rounded-2xl text-[13px] font-medium transition-all active:scale-[0.98]',
            isSaving || !config.endpoint?.trim() || !config.bucket?.trim() || !config.accessKeyId?.trim()
              ? 'bg-muted/30 text-muted-foreground'
              : 'bg-primary text-primary-foreground'
          )}
          onClick={handleSave}
          disabled={isSaving || !config.endpoint?.trim() || !config.bucket?.trim() || !config.accessKeyId?.trim()}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

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

export const S3Pane = memo(S3PaneInner)
