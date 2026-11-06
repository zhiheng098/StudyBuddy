/* ============================================================
   StudyBuddy · WorkBuddy 账号模块
   —— 决定「模型调用记在谁头上」的关键
   ============================================================ */

import { create } from 'zustand'
import { getWBClient } from './llm'

export interface WBUser {
  id?: string
  nickname?: string
  name?: string
  username?: string
  avatar?: string
  email?: string
}

interface AccountState {
  user: WBUser | null
  loading: boolean
  error: string
  /** 登录态检查是否已完成（避免恢复过程中误判） */
  restored: boolean
  /** 从 URL 回调参数恢复登录态 */
  restore: () => Promise<void>
  /** 发起 WorkBuddy 账号登录（同一标签页跳转） */
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  setError: (e: string) => void
}

export const useAccount = create<AccountState>()((set) => ({
  user: null,
  loading: false,
  error: '',
  restored: false,

  restore: async () => {
    try {
      const url = new URL(location.href)
      const hasCallback =
        url.searchParams.has('code') || url.searchParams.has('error')
      const provider = url.searchParams.get('provider')

      if (!hasCallback) {
        // 普通访问：恢复已存在的会话
        const cloud = await getWBClient()
        const res = await cloud.auth.getSession()
        const s = res?.data
        if (s && (s.user || s.accessToken)) {
          set({ user: normalizeUser(s), restored: true })
        } else {
          set({ user: null, restored: true })
        }
        return
      }

      if (provider !== 'workbuddy') {
        set({ error: '授权回调缺少有效的登录方式，请重新登录。', restored: true })
        return
      }

      set({ loading: true })
      const cloud = await getWBClient()
      const { data, error } = await cloud.auth.handleWorkBuddyCallback(location.search)
      if (error) {
        set({ error: String(error?.message ?? '登录失败，请重试'), loading: false, restored: true })
        return
      }
      if (data) {
        // 只清掉回调参数，保留 sharecode 等业务参数
        for (const k of ['code', 'state', 'provider']) url.searchParams.delete(k)
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
        const res = await cloud.auth.getSession()
        set({ user: normalizeUser(res?.data ?? data), error: '', loading: false, restored: true })
      } else {
        const res = await cloud.auth.getSession()
        set({ user: res?.data ? normalizeUser(res.data) : null, loading: false, restored: true })
      }
    } catch (e: any) {
      set({ error: e?.message ?? '登录状态检查失败', loading: false, restored: true })
    }
  },

  signIn: async () => {
    try {
      set({ loading: true, error: '' })
      const cloud = await getWBClient()
      const back = new URL(location.href)
      back.pathname = '/'
      // 不能把旧的回调参数带过去
      for (const k of ['code', 'state', 'provider']) back.searchParams.delete(k)
      const { data, error } = await cloud.auth.signInWithOAuth({
        provider: 'workbuddy',
        redirectTo: back.toString(),
      })
      if (error) {
        set({ error: String(error?.message ?? '登录失败'), loading: false })
        return
      }
      // 必须同标签页跳转，PKCE 证明存在当前标签页的 sessionStorage
      location.assign(data.url)
    } catch (e: any) {
      set({ error: e?.message ?? '登录失败', loading: false })
    }
  },

  signOut: async () => {
    try {
      const cloud = await getWBClient()
      await cloud.auth.signOut()
    } catch {
      /* 断网也要能登出 */
    } finally {
      set({ user: null, error: '' })
    }
  },

  setError: (error) => set({ error }),
}))

function normalizeUser(session: any): WBUser {
  const u = session?.user ?? session ?? {}
  return {
    id: u.id ?? u.user_id ?? u.sub,
    nickname: u.nickname ?? u.nickName ?? u.displayName ?? u.name,
    name: u.name,
    username: u.username,
    avatar: u.avatar ?? u.avatarUrl ?? u.avatar_url,
    email: u.email,
  }
}

/** 展示名 */
export function displayName(user: WBUser | null): string {
  if (!user) return '未登录'
  return user.nickname || user.name || user.username || user.email || 'WorkBuddy 用户'
}
