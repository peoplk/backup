/**
 * 习惯模板库（对标小日常/滴答清单习惯库）：
 * 新用户从模板一键预填，降低冷启动成本；模板仅提供建议值，创建后可自由修改。
 */

export interface HabitTemplate {
  id: string
  name: string
  icon: string
  category: 'health' | 'learning' | 'work' | 'life' | 'fitness' | 'mindfulness'
  trackingType: 'boolean' | 'quantity'
  /** 量化目标（trackingType='quantity' 时） */
  targetValue?: number
  unit?: string
  /** 一句话说明，用于模板 chip 的悬浮提示 */
  description?: string
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  // 健康
  { id: 'water', name: '喝够 8 杯水', icon: '💧', category: 'health', trackingType: 'quantity', targetValue: 8, unit: '杯', description: '每日饮水量打卡' },
  { id: 'vitamins', name: '吃维生素', icon: '💊', category: 'health', trackingType: 'boolean', description: '每日营养补充' },
  { id: 'early-sleep', name: '早睡', icon: '🛏️', category: 'health', trackingType: 'boolean', description: '23 点前入睡' },
  { id: 'early-rise', name: '早起', icon: '🌅', category: 'health', trackingType: 'boolean', description: '不赖床，按时起床' },
  { id: 'no-snack', name: '不吃零食', icon: '🍎', category: 'health', trackingType: 'boolean', description: '管住嘴，健康饮食' },
  { id: 'no-sugar-drink', name: '不喝含糖饮料', icon: '🥤', category: 'health', trackingType: 'boolean', description: '戒掉奶茶和碳酸饮料' },

  // 学习
  { id: 'reading', name: '阅读 30 分钟', icon: '📚', category: 'learning', trackingType: 'quantity', targetValue: 30, unit: '分钟', description: '每天读一点书' },
  { id: 'vocabulary', name: '背 20 个单词', icon: '🔤', category: 'learning', trackingType: 'quantity', targetValue: 20, unit: '个', description: '积累词汇量' },
  { id: 'english', name: '学英语', icon: '🗣️', category: 'learning', trackingType: 'boolean', description: '听说读写练一练' },
  { id: 'podcast', name: '听播客', icon: '🎧', category: 'learning', trackingType: 'boolean', description: '通勤路上的输入' },
  { id: 'course', name: '上网课', icon: '💻', category: 'learning', trackingType: 'boolean', description: '系统学习一门课程' },
  { id: 'notes', name: '写学习笔记', icon: '✍️', category: 'learning', trackingType: 'boolean', description: '输出倒逼输入' },

  // 工作
  { id: 'daily-plan', name: '写今日计划', icon: '📋', category: 'work', trackingType: 'boolean', description: '开工前理清今天要做什么' },
  { id: 'inbox-zero', name: '收件箱清零', icon: '📧', category: 'work', trackingType: 'boolean', description: '及时处理消息与邮件' },
  { id: 'deep-work', name: '深度工作', icon: '🧠', category: 'work', trackingType: 'quantity', targetValue: 2, unit: '小时', description: '无干扰专注产出' },
  { id: 'daily-review', name: '工作复盘', icon: '🔄', category: 'work', trackingType: 'boolean', description: '下班前回顾与收尾' },
  { id: 'skill-practice', name: '练专业技能', icon: '🛠️', category: 'work', trackingType: 'boolean', description: '精进本职手艺' },

  // 生活
  { id: 'tidy', name: '整理房间', icon: '🧹', category: 'life', trackingType: 'boolean', description: '保持环境清爽' },
  { id: 'expense', name: '记账', icon: '💰', category: 'life', trackingType: 'boolean', description: '记录每一笔开销' },
  { id: 'call-family', name: '联系家人', icon: '📞', category: 'life', trackingType: 'boolean', description: '常回家看看、常问候' },
  { id: 'steps', name: '走够 8000 步', icon: '👟', category: 'life', trackingType: 'quantity', targetValue: 8000, unit: '步', description: '日常活动量达标' },
  { id: 'journal', name: '写日记', icon: '📔', category: 'life', trackingType: 'boolean', description: '记录生活点滴' },

  // 运动
  { id: 'run', name: '跑步', icon: '🏃', category: 'fitness', trackingType: 'quantity', targetValue: 3, unit: '公里', description: '有氧耐力训练' },
  { id: 'gym', name: '健身', icon: '💪', category: 'fitness', trackingType: 'boolean', description: '力量训练打卡' },
  { id: 'stretch', name: '拉伸', icon: '🤸', category: 'fitness', trackingType: 'boolean', description: '放松肌肉、保持柔韧' },
  { id: 'pushups', name: '俯卧撑', icon: '🔝', category: 'fitness', trackingType: 'quantity', targetValue: 30, unit: '个', description: '上肢力量积累' },
  { id: 'yoga', name: '瑜伽', icon: '🧘', category: 'fitness', trackingType: 'boolean', description: '身心平衡练习' },

  // 冥想
  { id: 'meditate', name: '冥想 10 分钟', icon: '🧘', category: 'mindfulness', trackingType: 'quantity', targetValue: 10, unit: '分钟', description: '静坐观呼吸' },
  { id: 'gratitude', name: '感恩记录', icon: '🙏', category: 'mindfulness', trackingType: 'boolean', description: '写下今天值得感谢的事' },
  { id: 'breathing', name: '深呼吸练习', icon: '🌬️', category: 'mindfulness', trackingType: 'boolean', description: '缓解焦虑、平复情绪' },
  { id: 'no-phone', name: '睡前不刷手机', icon: '📱', category: 'mindfulness', trackingType: 'boolean', description: '还给自己一段安静时间' },
  { id: 'walk-mindful', name: '正念散步', icon: '🌳', category: 'mindfulness', trackingType: 'boolean', description: '不带目的地走一走' },
]
