'use client'

import { useState, useRef, useEffect, createContext, useContext, type ReactNode } from 'react'
import { useAppStore } from '@/lib/store'
import { parseEnhancedInput, validateParsedInput, getSmartSuggestions, type ParsedTaskInput } from '@/lib/smart-input-enhanced'
import { useShallow } from 'zustand/react/shallow'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Zap, ArrowRight, Lightbulb, CheckCircle2, AlertCircle, Calendar, Tag, Clock, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SmartInputContextValue {
  input: string
  parsed: ParsedTaskInput | null
  validation: ReturnType<typeof validateParsedInput>
  suggestions: string[]
  isFocused: boolean
  setInput: (value: string) => void
  handleSubmit: () => void
}

const SmartInputContext = createContext<SmartInputContextValue | null>(null)

function useSmartInput() {
  const context = useContext(SmartInputContext)
  if (!context) {
    throw new Error('useSmartInput must be used within SmartInputProvider')
  }
  return context
}

interface SmartInputProviderProps {
  children: ReactNode
  onSubmit?: (parsed: ParsedTaskInput) => void
}

function SmartInputProvider({ children, onSubmit }: SmartInputProviderProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const parsed = input ? parseEnhancedInput(input) : null
  const validation = parsed ? validateParsedInput(parsed) : { valid: true, warnings: [], suggestions: [] }
  const suggestions = input ? getSmartSuggestions(input) : []

  const handleSubmit = () => {
    if (!parsed || !validation.valid) return
    onSubmit?.(parsed)
    setInput('')
  }

  return (
    <SmartInputContext.Provider value={{
      input,
      parsed,
      validation,
      suggestions,
      isFocused,
      setInput,
      handleSubmit,
    }}>
      {children}
    </SmartInputContext.Provider>
  )
}

function SmartInputField() {
  const { input, setInput, isFocused, handleSubmit } = useSmartInput()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isFocused])

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 transition-all duration-200',
        isFocused
          ? 'border-primary/50 shadow-lg shadow-primary/10 ring-2 ring-primary/20'
          : 'border-border/50 hover:border-primary/30'
      )}
    >
      <Zap className={cn('h-5 w-5 shrink-0 transition-colors', isFocused ? 'text-primary' : 'text-muted-foreground')} />
      <Input
        ref={inputRef}
        placeholder="智能输入：明天下午3点开会 #工作 p1 @项目A 2🍅"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => {}}
        onBlur={() => setTimeout(() => {}, 200)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        className="h-9 border-none bg-transparent px-0 shadow-none focus-visible:ring-0 text-base placeholder:text-muted-foreground/60"
      />
      {input.trim() && (
        <Button
          size="sm"
          className="h-8 gap-1.5 px-4 shrink-0"
          onClick={handleSubmit}
        >
          <Plus className="h-4 w-4" />
          添加
        </Button>
      )}
    </div>
  )
}

function SmartInputPreview() {
  const { parsed, validation } = useSmartInput()

  if (!parsed || !parsed.title) return null

  return (
    <Card className="mt-2 border-primary/20 bg-primary/5">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">{parsed.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.dueDate && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Calendar className="h-3 w-3" />
                  {parsed.dueDate.toLocaleDateString('zh-CN')}
                </Badge>
              )}
              {parsed.startTime && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  {parsed.startTime}
                </Badge>
              )}
              {parsed.priority && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Target className="h-3 w-3" />
                  {parsed.priority}
                </Badge>
              )}
              {parsed.project && (
                <Badge variant="secondary" className="text-xs gap-1">
                  📁 {parsed.project}
                </Badge>
              )}
              {parsed.tags && parsed.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
              {parsed.estimatedPomodoros && (
                <Badge variant="secondary" className="text-xs gap-1">
                  🍅 {parsed.estimatedPomodoros}
                </Badge>
              )}
            </div>
            {validation.warnings.length > 0 && (
              <div className="flex items-start gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{validation.warnings[0]}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SmartInputSuggestions() {
  const { suggestions, input, setInput } = useSmartInput()

  if (suggestions.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => setInput(input + ' ' + suggestion)}
          className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <Lightbulb className="h-3 w-3" />
          {suggestion}
        </button>
      ))}
    </div>
  )
}

interface SmartQuickAddTaskProps {
  onSubmit?: (parsed: ParsedTaskInput) => void
  className?: string
}

export function SmartQuickAddTask({ onSubmit, className }: SmartQuickAddTaskProps) {
  const { addTask } = useAppStore(useShallow((state) => ({
    addTask: state.addTask,
  })))

  const handleSubmit = (parsed: ParsedTaskInput) => {
    addTask({
      title: parsed.title,
      description: undefined,
      type: 'task',
      priority: parsed.priority || 'medium',
      project: parsed.project || '',
      tags: parsed.tags || [],
      dueDate: parsed.dueDate,
      startTime: parsed.startTime,
      status: 'todo',
      estimatedPomodoros: parsed.estimatedPomodoros || 1,
      energy: parsed.energy,
    })
    onSubmit?.(parsed)
  }

  return (
    <div className={cn('relative', className)}>
      <SmartInputProvider onSubmit={handleSubmit}>
        <SmartInputField />
        <SmartInputPreview />
        <SmartInputSuggestions />
      </SmartInputProvider>
    </div>
  )
}

export { SmartInputProvider, SmartInputField, SmartInputPreview, SmartInputSuggestions, useSmartInput }
