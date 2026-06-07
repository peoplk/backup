'use client'

import { useState } from 'react'
import { useAppStore, Task } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  MoreHorizontal,
  Star,
  Briefcase,
  Home,
  ShoppingBag,
  Dumbbell,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TaskTemplate {
  id: string
  name: string
  title: string
  description?: string
  priority: Task['priority']
  project?: string
  tags: string[]
  estimatedPomodoros: number
  icon?: React.ReactNode
}

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'template-1',
    name: '日常会议',
    title: '参加团队会议',
    description: '准备会议议程，记录会议纪要',
    priority: 'high',
    project: '工作',
    tags: ['会议', '团队'],
    estimatedPomodoros: 2,
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    id: 'template-2',
    name: '代码开发',
    title: '开发新功能',
    description: '编写代码，进行代码审查',
    priority: 'high',
    project: '开发',
    tags: ['编程', '开发'],
    estimatedPomodoros: 4,
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: 'template-3',
    name: '健身运动',
    title: '健身锻炼',
    description: '完成今日健身计划',
    priority: 'medium',
    tags: ['健康', '运动'],
    estimatedPomodoros: 2,
    icon: <Dumbbell className="h-4 w-4" />,
  },
  {
    id: 'template-4',
    name: '家务整理',
    title: '整理房间',
    description: '打扫卫生，整理物品',
    priority: 'low',
    tags: ['生活', '家务'],
    estimatedPomodoros: 1,
    icon: <Home className="h-4 w-4" />,
  },
  {
    id: 'template-5',
    name: '购物清单',
    title: '购买生活用品',
    description: '列出需要购买的物品清单',
    priority: 'low',
    tags: ['生活', '购物'],
    estimatedPomodoros: 1,
    icon: <ShoppingBag className="h-4 w-4" />,
  },
  {
    id: 'template-6',
    name: '学习阅读',
    title: '阅读学习',
    description: '阅读书籍或学习新知识',
    priority: 'medium',
    tags: ['学习', '成长'],
    estimatedPomodoros: 2,
    icon: <BookOpen className="h-4 w-4" />,
  },
]

interface TaskTemplatesProps {
  onSelectTemplate: (template: TaskTemplate) => void
}

export function TaskTemplates({ onSelectTemplate }: TaskTemplatesProps) {
  const [customTemplates, setCustomTemplates] = useState<TaskTemplate[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTemplate, setNewTemplate] = useState<Partial<TaskTemplate>>({
    name: '',
    title: '',
    description: '',
    priority: 'medium',
    tags: [],
    estimatedPomodoros: 1,
  })
  const [newTag, setNewTag] = useState('')

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates]

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.title) return

    const template: TaskTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplate.name,
      title: newTemplate.title,
      description: newTemplate.description,
      priority: newTemplate.priority as Task['priority'],
      tags: newTemplate.tags || [],
      estimatedPomodoros: newTemplate.estimatedPomodoros || 1,
    }

    setCustomTemplates([...customTemplates, template])
    setNewTemplate({
      name: '',
      title: '',
      description: '',
      priority: 'medium',
      tags: [],
      estimatedPomodoros: 1,
    })
    setIsCreateDialogOpen(false)
  }

  const handleDeleteTemplate = (id: string) => {
    setCustomTemplates(customTemplates.filter((t) => t.id !== id))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !newTemplate.tags?.includes(newTag.trim())) {
      setNewTemplate({
        ...newTemplate,
        tags: [...(newTemplate.tags || []), newTag.trim()],
      })
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setNewTemplate({
      ...newTemplate,
      tags: newTemplate.tags?.filter((t) => t !== tag),
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            任务模板
          </CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建任务模板</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">模板名称</label>
                  <Input
                    placeholder="例如：日常会议"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">任务标题</label>
                  <Input
                    placeholder="例如：参加团队会议"
                    value={newTemplate.title}
                    onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">描述</label>
                  <Input
                    placeholder="可选描述"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">优先级</label>
                    <Select
                      value={newTemplate.priority}
                      onValueChange={(value: Task['priority']) =>
                        setNewTemplate({ ...newTemplate, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">紧急</SelectItem>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">预估番茄钟</label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={newTemplate.estimatedPomodoros}
                      onChange={(e) =>
                        setNewTemplate({ ...newTemplate, estimatedPomodoros: parseInt(e.target.value) || 1 })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">标签</label>
                  <div className="flex flex-wrap gap-2">
                    {newTemplate.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)}>
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加标签..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <Button size="sm" variant="outline" onClick={handleAddTag}>
                      添加
                    </Button>
                  </div>
                </div>
                <Button onClick={handleCreateTemplate} className="w-full">
                  创建模板
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allTemplates.map((template) => (
            <div
              key={template.id}
              className={cn(
                'group relative rounded-lg border p-3 cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm',
                template.priority === 'urgent' && 'border-l-2 border-l-destructive',
                template.priority === 'high' && 'border-l-2 border-l-chart-3',
                template.priority === 'medium' && 'border-l-2 border-l-chart-1',
                template.priority === 'low' && 'border-l-2 border-l-muted-foreground'
              )}
              onClick={() => onSelectTemplate(template)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {template.icon}
                  <span className="text-sm font-medium">{template.name}</span>
                </div>
                {template.id.startsWith('custom-') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteTemplate(template.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                {template.title}
              </p>
              {template.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export { DEFAULT_TEMPLATES }
export type { TaskTemplate as TaskTemplateType }
