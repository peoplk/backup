import type { TreeState } from '@/lib/types'

export function getTreeStateFromGrowth(growth: number): TreeState {
  if (growth <= 0) return 'seed'
  if (growth <= 25) return 'sprout'
  if (growth <= 50) return 'sapling'
  if (growth <= 75) return 'growing'
  return 'mature'
}

export function getNextTreeState(current: TreeState, growth: number): TreeState {
  // 树木死亡只代表当前这棵树；重新种植后按成长度正常进阶
  return getTreeStateFromGrowth(growth)
}

export function getTreeLabel(state: TreeState): string {
  const labels: Record<TreeState, string> = {
    seed: '种子',
    sprout: '发芽',
    sapling: '幼苗',
    growing: '成长中',
    mature: '已长成',
    withered: '已枯萎',
  }
  return labels[state]
}

export function getTreeColorClass(state: TreeState): string {
  switch (state) {
    case 'seed':
      return 'text-amber-700'
    case 'sprout':
      return 'text-chart-2/50'
    case 'sapling':
      return 'text-chart-2/70'
    case 'growing':
      return 'text-chart-2'
    case 'mature':
      return 'text-emerald-500'
    case 'withered':
      return 'text-stone-500'
    default:
      return 'text-chart-2'
  }
}
