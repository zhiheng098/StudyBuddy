import { useEffect, useRef, useState } from 'react'
import { LogIn, LogOut, ShieldCheck, User } from 'lucide-react'
import { displayName, useAccount } from '../lib/account'

/**
 * WorkBuddy 账号入口。
 * 登录后模型调用会计入「你自己」的 WorkBuddy 积分；
 * 未登录时不会消耗任何人的积分（作者已关闭公共兜底通道）。
 */
export function AccountChip({ compact = false }: { compact?: boolean }) {
  const { user, loading, error, signIn, signOut } = useAccount()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!user) {
    return (
      <button
        onClick={() => signIn()}
        disabled={loading}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[13px] text-ink-soft transition hover:bg-primary-soft hover:text-primary disabled:opacity-60"
        title="登录后，模型调用计入你自己的 WorkBuddy 积分"
      >
        <LogIn size={15} className="shrink-0" />
        <span className="truncate">{loading ? '正在跳转登录…' : '使用 WorkBuddy 登录'}</span>
      </button>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[13px] text-ink-soft transition hover:bg-panel-2 hover:text-ink"
        title="WorkBuddy 账号"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-[18px] w-[18px] shrink-0 rounded-full" />
        ) : (
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-[9px] font-semibold text-white">
            {displayName(user).slice(0, 1)}
          </span>
        )}
        <span className="truncate">{displayName(user)}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-60 rounded-xl border bg-[var(--panel)] p-3 shadow-[var(--shadow-lg)]">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <ShieldCheck size={13} className="text-good" />
            {displayName(user)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">
            已登录 WorkBuddy 账号。当前模型调用<b className="text-ink-soft">计入你自己的积分</b>，
            不会消耗作品创建者的额度。
          </p>
          <button
            onClick={() => {
              setOpen(false)
              signOut()
            }}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11.5px] text-ink-soft transition hover:border-danger/40 hover:text-danger"
          >
            <LogOut size={12} />
            退出登录
          </button>
        </div>
      )}
      {error && !compact && (
        <p className="px-2.5 pt-1 text-[10.5px] leading-relaxed text-danger">{error}</p>
      )}
    </div>
  )
}

/** 顶栏用的极简版本 */
export function AccountPill() {
  const { user, loading, signIn, signOut } = useAccount()
  if (!user) {
    return (
      <button
        onClick={() => signIn()}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-1.5 text-[11.5px] font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-60"
      >
        <LogIn size={12} />
        {loading ? '跳转中…' : '使用 WorkBuddy 登录'}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-good/30 bg-good/8 px-2.5 py-1.5 text-[11.5px] text-good">
      <User size={12} />
      <span className="max-w-[110px] truncate">{displayName(user)}</span>
      <button
        onClick={() => signOut()}
        className="ml-0.5 rounded-full p-0.5 text-good/70 transition hover:bg-good/15 hover:text-good"
        title="退出登录"
      >
        <LogOut size={11} />
      </button>
    </div>
  )
}
