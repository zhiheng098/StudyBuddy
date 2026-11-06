/* ============================================================
   StudyBuddy · 艾宾浩斯间隔重复调度
   ============================================================ */

/** 复习间隔阶梯（天） */
export const EBBINGHAUS_STEPS = [1, 2, 4, 7, 15, 30, 60]

export type ReviewQuality = 'again' | 'hard' | 'good' | 'easy'

export interface SrsState {
  stage: number
  nextReviewAt: number
  intervalDays: number
  quality: ReviewQuality
}

/**
 * 依据本次复习得分推进/回退复习排期。
 * @param score 0~100
 */
export function scheduleReview(
  score: number,
  stage: number,
  now = Date.now(),
): SrsState {
  let quality: ReviewQuality
  if (score >= 90) quality = 'easy'
  else if (score >= 70) quality = 'good'
  else if (score >= 50) quality = 'hard'
  else quality = 'again'

  let nextStage = stage
  switch (quality) {
    case 'easy':
      nextStage = Math.min(EBBINGHAUS_STEPS.length - 1, stage + 2)
      break
    case 'good':
      nextStage = Math.min(EBBINGHAUS_STEPS.length - 1, stage + 1)
      break
    case 'hard':
      nextStage = stage
      break
    case 'again':
      nextStage = 0
      break
  }

  const intervalDays = EBBINGHAUS_STEPS[nextStage]
  return {
    stage: nextStage,
    intervalDays,
    nextReviewAt: now + intervalDays * 24 * 60 * 60 * 1000,
    quality,
  }
}

/** 今日应复习的判断（含逾期） */
export function isDue(nextReviewAt: number | undefined, now = Date.now()): boolean {
  if (!nextReviewAt) return true
  return nextReviewAt <= now
}

/** 距下次复习的自然语言描述 */
export function describeDue(nextReviewAt: number | undefined, now = Date.now()): string {
  if (!nextReviewAt) return '待安排'
  const diff = nextReviewAt - now
  if (diff <= 0) {
    const overdue = Math.floor(-diff / (24 * 3600 * 1000))
    return overdue >= 1 ? `已逾期 ${overdue} 天` : '今日待复习'
  }
  const days = Math.ceil(diff / (24 * 3600 * 1000))
  if (days <= 1) return '今天内'
  if (days <= 30) return `${days} 天后`
  return `${Math.round(days / 30)} 个月后`
}

/** 依据模块掌握度估算星级进度（0~120），对应「星空成长」的星辰数 */
export function galaxyProgress(
  masteredModules: number,
  totalModules: number,
  avgMastery: number,
): number {
  const modulePart = totalModules ? (masteredModules / totalModules) * 90 : 0
  const masteryPart = Math.max(0, Math.min(1, avgMastery)) * 30
  return Math.round(modulePart + masteryPart)
}
