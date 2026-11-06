/* ============================================================
   StudyBuddy · 全局状态
   ============================================================ */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, LLMConfig, ThemeName } from '../types'
import { db, uid } from '../lib/db'

export type ViewKey =
  | 'home'
  | 'chat'
  | 'reading'
  | 'library'
  | 'knowledge'
  | 'memory'
  | 'quiz'
  | 'growth'
  | 'research'
  | 'settings'

export interface AppState {
  /* 设置（持久化） */
  settings: AppSettings
  patchSettings: (patch: Partial<AppSettings>) => void
  patchLLM: (patch: Partial<LLMConfig>) => void
  setTheme: (t: ThemeName) => void

  /* 运行时 */
  view: ViewKey
  setView: (v: ViewKey) => void
  conversationId: string | null
  setConversationId: (id: string | null) => void
  activeDocId: string | null
  setActiveDocId: (id: string | null) => void
  rightTab: 'context' | 'outline' | 'memory'
  setRightTab: (t: 'context' | 'outline' | 'memory') => void
  /** 触发全局事件（例如"从图谱跳到讲解"） */
  pendingPrompt: string | null
  consumePendingPrompt: () => string | null
  setPendingPrompt: (p: string | null) => void
  /** 全局 toast */
  toast: { id: string; text: string; tone: 'info' | 'good' | 'bad' } | null
  notify: (text: string, tone?: 'info' | 'good' | 'bad') => void
}

const defaultLLM: LLMConfig = {
  // 默认不指向任何需要消耗他人额度的通道；未登录 WorkBuddy 时不自动切换
  channel: 'demo',
  baseURL: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
  demoMode: true,
}

const defaultSettings: AppSettings = {
  theme: 'classic',
  llm: defaultLLM,
  leftWidth: 232,
  rightWidth: 320,
  leftCollapsed: false,
  rightCollapsed: false,
  autoContext: true,
  persona: '',
  userName: '同学',
  streak: 0,
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      patchSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      patchLLM: (patch) =>
        set((s) => ({
          settings: { ...s.settings, llm: { ...s.settings.llm, ...patch } },
        })),
      setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),

      view: 'home',
      setView: (view) => set({ view }),
      conversationId: null,
      setConversationId: (conversationId) => set({ conversationId }),
      activeDocId: null,
      setActiveDocId: (activeDocId) => set({ activeDocId }),
      rightTab: 'context',
      setRightTab: (rightTab) => set({ rightTab }),
      pendingPrompt: null,
      setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
      consumePendingPrompt: () => {
        const p = get().pendingPrompt
        if (p) set({ pendingPrompt: null })
        return p
      },
      toast: null,
      notify: (text, tone = 'info') => {
        const id = uid('t_')
        set({ toast: { id, text, tone } })
        setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null })
        }, 2800)
      },
    }),
    {
      name: 'studybuddy.settings',
      partialize: (s) => ({ settings: s.settings }) as any,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // 主题同步到 DOM
        applyTheme(state.settings.theme)
        // 迁移：已停用的「公共体验通道」一律回落到演示模式，避免继续消耗作者额度
        const ch = state.settings.llm?.channel as string | undefined
        if (ch === 'shared' || !ch) {
          state.settings.llm = { ...state.settings.llm, channel: 'demo', demoMode: true }
        }
      },
    },
  ),
)

export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute('data-theme', theme)
}

/* ---------------- 会话辅助 ---------------- */
export async function ensureConversation(id: string | null, title = '新对话'): Promise<string> {
  if (id) {
    const existing = await db.conversations.get(id)
    if (existing) return id
  }
  const cid = uid('conv_')
  await db.conversations.add({
    id: cid,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: 'chat',
  })
  return cid
}
