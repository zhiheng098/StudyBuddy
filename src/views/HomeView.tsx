import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  BookOpen,
  Brain,
  Compass,
  FileText,
  Library,
  Network,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useApp } from '../store/app'
import { AccountPill } from '../components/AccountChip'
import { useAccount } from '../lib/account'
import { db } from '../lib/db'
import { studyStats } from '../lib/db'

const CARDS = [
  {
    key: 'library' as const,
    icon: Library,
    tint: 'from-accent/18 to-accent/0',
    color: 'text-accent',
    title: '资料库',
    desc: '上传 PDF / Word / 图片，AI 读懂每一页并建立可检索的知识底座。',
  },
  {
    key: 'reading' as const,
    icon: BookOpen,
    tint: 'from-primary/18 to-primary/0',
    color: 'text-primary',
    title: '沉浸式阅读',
    desc: '选中哪一段，就讲哪一段。带页码引用的逐句解释。',
  },
  {
    key: 'growth' as const,
    icon: Compass,
    tint: 'from-good/18 to-good/0',
    color: 'text-good',
    title: '星空成长',
    desc: '水平诊断 → 自动分模块 → 逐个消化 → 检验 → 间隔复习。',
  },
  {
    key: 'quiz' as const,
    icon: Sparkles,
    tint: 'from-warn/18 to-warn/0',
    color: 'text-warn',
    title: '题库与错题',
    desc: '按文档出题、自动批改，错题自动归档，供你复盘。',
  },
]

export function HomeView() {
  const { setView, setConversationId, notify, setPendingPrompt } = useApp()
  const user = useAccount((s) => s.user)
  const [text, setText] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      setStats(await studyStats())
      const list = await db.docs.orderBy('updatedAt').reverse().limit(4).toArray()
      setDocs(list)
    }
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const ask = async () => {
    const q = text.trim()
    if (!q) return
    const id = `conv_${Date.now().toString(36)}`
    await db.conversations.add({
      id,
      title: q.slice(0, 24),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: 'chat',
    })
    setConversationId(id)
    setText('')
    setPendingPrompt(q)
    setView('chat')
  }

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* 顶栏：账号与计费归属 */}
        <div className="mb-6 flex items-center justify-end gap-2">
          <span className="hidden text-[11.5px] text-ink-mute sm:inline">
            {user ? '已登录 · 调用计入你的 WorkBuddy 积分' : '未登录 · 不消耗任何人的积分'}
          </span>
          <AccountPill />
        </div>

        {/* Hero */}
        <div className="text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">你想学点什么？</h1>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-ink-mute">
            上传你的教材、论文或笔记。选中其中任意一段，AI 助教会就这段内容给你解释、举例、画图、出题，
            并把学过的一切沉淀成可复习的个人知识库。
          </p>

          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border bg-[var(--panel)] p-2 shadow-[var(--shadow)] transition focus-within:border-primary/50">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ask()
                }
              }}
              rows={2}
              placeholder="今天我想搞懂什么？（Enter 发送）"
              className="w-full resize-none bg-transparent px-3 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-ink-mute"
            />
            <div className="flex items-center gap-2 px-1 pb-0.5">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-soft transition hover:bg-primary-soft hover:text-primary"
              >
                <Upload size={13} />
                上传资料
              </button>
              <span className="text-[11px] text-ink-mute">PDF · Word · Markdown · 文本 · 图片</span>
              <button
                onClick={ask}
                disabled={!text.trim()}
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary text-white shadow-[var(--shadow-sm)] transition disabled:opacity-40 enabled:hover:brightness-110"
              >
                <ArrowUp size={15} />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,.csv,.json,.py,.ts,.js"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  notify(`已选择 ${f.name}，前往资料库完成上传`)
                  setView('library')
                }
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* 能力卡片 */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.key}
                onClick={() => setView(c.key)}
                className="card hover-lift group relative overflow-hidden p-4 text-left"
              >
                <span
                  className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${c.tint} blur-xl transition group-hover:scale-125`}
                />
                <span
                  className={`relative mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${c.tint} ${c.color}`}
                >
                  <Icon size={17} />
                </span>
                <p className="relative text-[13.5px] font-medium text-ink">{c.title}</p>
                <p className="relative mt-1 text-[11.5px] leading-relaxed text-ink-mute">{c.desc}</p>
              </button>
            )
          })}
        </div>

        {/* 统计 */}
        {stats && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: FileText, label: '资料', value: stats.docs },
              { icon: Brain, label: '知识点', value: stats.knowledge },
              { icon: Network, label: '知识模块', value: stats.modules },
              { icon: Sparkles, label: '已掌握', value: stats.mastered },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="card flex items-center gap-3 p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon size={15} />
                  </span>
                  <div>
                    <p className="text-[17px] font-semibold leading-tight text-ink">{s.value}</p>
                    <p className="text-[11px] text-ink-mute">{s.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 最近资料 */}
        {docs.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-2.5 text-[13px] font-medium text-ink-soft">最近资料</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    useApp.getState().setActiveDocId(d.id)
                    setView('reading')
                  }}
                  className="card hover-lift flex items-center gap-3 p-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-ink-mute">
                    <FileText size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{d.name}</span>
                    <span className="block text-[11px] text-ink-mute">
                      {d.kind.toUpperCase()} · {d.pages} 页
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
