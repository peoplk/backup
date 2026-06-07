'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { FilterCriteria } from '@/lib/types'
import { Filter, Save, Trash2, X, Edit3, Check } from 'lucide-react'

interface SavedFiltersBarProps {
  criteria: FilterCriteria
  onApply: (criteria: FilterCriteria) => void
}

function isCriteriaEmpty(c: FilterCriteria): boolean {
  return !c.search && !c.priority && !c.status && !c.tag && !c.type && !c.date && !c.project
}

function isEqualCriteria(a: FilterCriteria, b: FilterCriteria): boolean {
  return (
    (a.search || '') === (b.search || '') &&
    (a.priority || '') === (b.priority || '') &&
    (a.status || '') === (b.status || '') &&
    (a.tag || '') === (b.tag || '') &&
    (a.type || '') === (b.type || '') &&
    (a.date || '') === (b.date || '') &&
    (a.project || '') === (b.project || '')
  )
}

function describeCriteria(c: FilterCriteria): string {
  const parts: string[] = []
  if (c.search) parts.push(`"${c.search}"`)
  if (c.priority) parts.push(`优先级=${c.priority}`)
  if (c.status) parts.push(`状态=${c.status}`)
  if (c.tag) parts.push(`#${c.tag}`)
  if (c.type) parts.push(`类型=${c.type}`)
  if (c.date) parts.push(`日期=${c.date}`)
  if (c.project) parts.push(`项目=${c.project}`)
  return parts.join(' · ')
}

export function SavedFiltersBar({ criteria, onApply }: SavedFiltersBarProps) {
  const {
    savedFilters,
    addSavedFilter,
    deleteSavedFilter,
    renameSavedFilter,
    activeSavedFilterId,
    setActiveSavedFilterId,
  } = useAppStore()

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const canSave = !isCriteriaEmpty(criteria)

  const handleSave = () => {
    const name = saveName.trim()
    if (!name) return
    addSavedFilter(name, criteria)
    setSaveName('')
    setSaveDialogOpen(false)
  }

  const handleApply = (id: string) => {
    const f = savedFilters.find(x => x.id === id)
    if (!f) return
    setActiveSavedFilterId(id)
    onApply(f.criteria)
  }

  const handleClearActive = () => {
    setActiveSavedFilterId(null)
    onApply({})
  }

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id)
    setEditingName(currentName)
  }

  const handleCommitEdit = () => {
    if (editingId && editingName.trim()) {
      renameSavedFilter(editingId, editingName)
    }
    setEditingId(null)
    setEditingName('')
  }

  // 当前筛选条件与已保存的某一项匹配时高亮
  const matchedId = savedFilters.find(f => isEqualCriteria(f.criteria, criteria))?.id

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        <Filter className="w-3.5 h-3.5" />
        <span>已保存筛选:</span>
      </div>

      {savedFilters.length === 0 && (
        <span className="text-xs text-slate-400 dark:text-slate-500 italic">暂无</span>
      )}

      {savedFilters.map(f => {
        const isActive = f.id === activeSavedFilterId
        const isMatched = f.id === matchedId
        return (
          <div
            key={f.id}
            className={`group flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
              isActive || isMatched
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-transparent hover:border-slate-300 dark:hover:border-slate-500'
            }`}
            title={describeCriteria(f.criteria)}
          >
            {editingId === f.id ? (
              <>
                <input
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCommitEdit()
                    if (e.key === 'Escape') {
                      setEditingId(null)
                      setEditingName('')
                    }
                  }}
                  className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded text-xs w-24 outline-none border border-blue-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCommitEdit}
                  className="text-emerald-500 hover:text-emerald-700"
                  aria-label="确认"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setEditingName('')
                  }}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="取消"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleApply(f.id)}
                  className="hover:underline"
                >
                  {f.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartEdit(f.id, f.name)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700"
                  aria-label="重命名"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`删除筛选 "${f.name}"？`)) {
                      deleteSavedFilter(f.id)
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                  aria-label="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        )
      })}

      {activeSavedFilterId && (
        <button
          type="button"
          onClick={handleClearActive}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
          title="清除当前激活的筛选"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {canSave && (
        <>
          {saveDialogOpen ? (
            <div className="flex items-center gap-1 ml-1">
              <input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') {
                    setSaveDialogOpen(false)
                    setSaveName('')
                  }
                }}
                placeholder="筛选名…"
                className="text-xs px-2 py-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 outline-none w-28"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSave}
                className="text-xs px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveDialogOpen(false)
                  setSaveName('')
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSaveDialogOpen(true)}
              className="text-xs px-2 py-1 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              保存当前筛选
            </button>
          )}
        </>
      )}
    </div>
  )
}
