import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Brain,
  ClipboardList,
  FolderOpen,
  Home,
  Network,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Telescope,
  X,
} from 'lucide-react'
import { LogoWord } from '../Logo'
import { AccountChip } from '../AccountChip'
import { CollapseButton } from './Resizer'
import { useApp, type ViewKey } from '../../store/app'
import { db } from '../../lib/db'

const NAV: { key: ViewKey; label: string; icon: any }[] = [
  { key: 'home', label: '主页', icon: Home },
  { key: 'reading', label: '沉浸式阅读', icon: BookOpen },
  { key: 'library', label: '资料库', icon: FolderOpen },
  { key: 'knowledge', label: '知识图谱', icon: Network },
  { key: 'memory', label: '记忆库', icon: Brain },
  { key: 'quiz', label: '题库与练习', icon: ClipboardList },
  { key: 'growth', label: '星空成长', icon: Sparkles },
  { key: 'research', label: '文献调研', icon: Telescope },
]

export function Sidebar() {
  const { view, setView, conversationId, setConversationId, settings } = useApp()
  const [recent, setRecent] = useState<{ id: string; title: string; updatedAt: number }[]>([])
  const [showRecent, setShowRecent] = useState(true)

  const loadRecent = async () => {
    const list = await db.conversations.orderBy('updatedAt').reverse().limit(12).toArray()
    setRecent(
      list.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })),
    )
  }

  useEffect(() => {
    loadRecent()
    const t = setInterval(loadRecent, 4000)
    return () => clearInterval(t)
  }, [view, conversationId])

  const groups = useMemo(() => {
    const now = new Date()
    const dayStart = new Date(now).setHours(0, 0, 0, 0)
    const weekStart = dayStart - 7 * 86400000
    return {
      today: recent.filter((r) => r.updatedAt >= dayStart),
      earlier: recent.filter((r) => r.updatedAt < dayStart && r.updatedAt >= weekStart),
      older: recent.filter((r) => r.updatedAt < weekStart),
    }
  }, [recent])

  const newChat = async () => {
    const id = `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    await db.conversations.add({
      id,
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: 'chat',
    })
    setConversationId(id)
    setView('chat')
    loadRecent()
  }

  return (
    <aside
      className="relative z-10 flex h-full flex-col border-r bg-[var(--panel-trans)] backdrop-blur-xl transition-[width] duration-200"
      style={{ width: settings.leftWidth }}
    >
      {/* 顶部 */}
      <div className="flex h-14 shrink-0 items-center justify-between px-3.5">
        <button onClick={() => setView('home')} className="rounded-lg px-1 py-1 transition hover:opacity-80">
          <LogoWord />
        </button>
        <CollapseButton side="left" />
      </div>

      {/* 主导航 */}
      <nav className="px-2.5">
        <button
          onClick={newChat}
          className="mb-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-soft transition hover:bg-primary-soft hover:text-primary"
        >
          <Plus size={15} />
          新建对话
        </button>
        <ul className="space-y-[2px]">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = view === item.key
            return (
              <li key={item.key}>
                <button
                  onClick={() => setView(item.key)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition ${
                    active
                      ? 'bg-primary-soft font-medium text-primary'
                      : 'text-ink-soft hover:bg-panel-2 hover:text-ink'
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 最近对话 */}
      <div className="mt-4 min-h-0 flex-1 overflow-hidden px-2.5">
        <button
          onClick={() => setShowRecent((v) => !v)}
          className="mb-1 flex w-full items-center justify-between px-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-mute"
        >
          <span>最近</span>
          <span className="text-[10px] normal-case">{showRecent ? '收起' : ''}</span>
        </button>
        {showRecent && (
          <div className="scroll-area h-[calc(100%-28px)] pb-3">
            {groups.today.length > 0 && (
              <Group title="今天" items={groups.today} current={conversationId} onPick={(id) => { setConversationId(id); setView('chat') }} />
            )}
            {groups.earlier.length > 0 && (
              <Group title="本周" items={groups.earlier} current={conversationId} onPick={(id) => { setConversationId(id); setView('chat') }} />
            )}
            {groups.older.length > 0 && (
              <Group title="更早" items={groups.older} current={conversationId} onPick={(id) => { setConversationId(id); setView('chat') }} />
            )}
            {recent.length === 0 && (
              <p className="px-2.5 py-3 text-[12px] leading-relaxed text-ink-mute">
                还没有对话。上传一份文档，选中任意一段，AI 助教就会开始讲解。
              </p>
            )}
          </div>
        )}
      </div>

      {/* 底部 */}
      <div className="shrink-0 border-t p-2.5">
        <AccountChip />
        <button
          onClick={() => setView('settings')}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition ${
            view === 'settings' ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-panel-2 hover:text-ink'
          }`}
        >
          <SettingsIcon size={15} />
          设置
        </button>
      </div>
    </aside>
  )
}

function Group({
  title,
  items,
  current,
  onPick,
}: {
  title: string
  items: { id: string; title: string }[]
  current: string | null
  onPick: (id: string) => void
}) {
  return (
    <div className="mb-2">
      <p className="px-2.5 pb-0.5 text-[11px] text-ink-mute">{title}</p>
      <ul>
        {items.map((c) => (
          <li key={c.id} className="group relative">
            <button
              onClick={() => onPick(c.id)}
              className={`flex w-full items-center rounded-lg px-2.5 py-[6px] pr-7 text-left text-[12.5px] transition ${
                current === c.id
                  ? 'bg-primary-soft text-primary'
                  : 'text-ink-soft hover:bg-panel-2 hover:text-ink'
              }`}
            >
              <span className="truncate">{c.title}</span>
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                await db.conversations.delete(c.id)
                loadRecentSafe()
              }}
              className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-1 text-ink-mute hover:text-danger group-hover:block"
              title="删除对话"
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

async function loadRecentSafe() {
  /* 删除后由轮询刷新 */
}
