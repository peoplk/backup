'use client'

import { Brain, Coffee, TreeDeciduous } from 'lucide-react'

export type TimerMode = 'work' | 'short-break' | 'long-break'

export const modeConfig = {
  work: {
    label: '专注',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1',
    gradient: 'from-chart-1/20 to-chart-1/5',
    gradientFrom: 'oklch(0.57 0.14 250)',
    gradientTo: 'oklch(0.45 0.12 250)',
    glowColor: 'oklch(0.57 0.14 250 / 0.4)',
    icon: Brain,
    // 工作模式的颜色阶段：从蓝色 -> 青色 -> 绿色 -> 黄色 -> 橙色 -> 红色
    colorStages: [
      { progress: 0, from: [100, 70, 250], to: [80, 60, 250] },      // 蓝色
      { progress: 20, from: [70, 180, 250], to: [50, 150, 250] },    // 青色
      { progress: 40, from: [100, 200, 100], to: [80, 180, 80] },    // 绿色
      { progress: 60, from: [250, 200, 50], to: [230, 180, 30] },    // 黄色
      { progress: 80, from: [250, 150, 50], to: [230, 130, 30] },    // 橙色
      { progress: 100, from: [250, 80, 80], to: [230, 60, 60] },     // 红色
    ],
  },
  'short-break': {
    label: '短休息',
    color: 'text-chart-2',
    bgColor: 'bg-chart-2',
    gradient: 'from-chart-2/20 to-chart-2/5',
    gradientFrom: 'oklch(0.65 0.18 145)',
    gradientTo: 'oklch(0.50 0.15 145)',
    glowColor: 'oklch(0.65 0.18 145 / 0.4)',
    icon: Coffee,
    // 短休息：从浅绿 -> 深绿
    colorStages: [
      { progress: 0, from: [150, 250, 150], to: [120, 220, 120] },
      { progress: 100, from: [50, 200, 100], to: [30, 180, 80] },
    ],
  },
  'long-break': {
    label: '长休息',
    color: 'text-chart-3',
    bgColor: 'bg-chart-3',
    gradient: 'from-chart-3/20 to-chart-3/5',
    gradientFrom: 'oklch(0.75 0.15 65)',
    gradientTo: 'oklch(0.60 0.12 65)',
    glowColor: 'oklch(0.75 0.15 65 / 0.4)',
    icon: TreeDeciduous,
    // 长休息：从浅橙 -> 深橙
    colorStages: [
      { progress: 0, from: [255, 200, 150], to: [235, 180, 130] },
      { progress: 100, from: [255, 140, 50], to: [235, 120, 30] },
    ],
  },
}

// 插值函数：根据进度计算当前颜色
export function interpolateColor(progress: number, stages: { progress: number; from: number[]; to: number[] }[]) {
  // 找到当前进度所在的阶段
  let lowerStage = stages[0]
  let upperStage = stages[stages.length - 1]

  for (let i = 0; i < stages.length - 1; i++) {
    if (progress >= stages[i].progress && progress <= stages[i + 1].progress) {
      lowerStage = stages[i]
      upperStage = stages[i + 1]
      break
    }
  }

  // 计算在当前阶段内的进度比例
  const stageProgress = (progress - lowerStage.progress) / (upperStage.progress - lowerStage.progress)
  const clampedProgress = Math.max(0, Math.min(1, stageProgress))

  // 插值计算 from 和 to 颜色
  const fromColor = lowerStage.from.map((start, i) => {
    const end = upperStage.from[i]
    return Math.round(start + (end - start) * clampedProgress)
  })

  const toColor = lowerStage.to.map((start, i) => {
    const end = upperStage.to[i]
    return Math.round(start + (end - start) * clampedProgress)
  })

  return {
    from: `rgb(${fromColor[0]}, ${fromColor[1]}, ${fromColor[2]})`,
    to: `rgb(${toColor[0]}, ${toColor[1]}, ${toColor[2]})`,
  }
}
