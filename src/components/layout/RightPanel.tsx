import { useEffect, useState } from 'react'
import {
  BookOpen,
  Brain,
  FileText,
  Layers,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Waves,
  Zap,
} from 'lucide-react'
import { useApp } from '../../store/app'
import type { ThemeName } from '../../types'
import { CollapseButton } from './Resizer'
import { AccountChip } from '../AccountChip'
import { displayName, useAccount } from '../../lib/account'

const THEMES: { key: ThemeName; label: string; desc: string; icon: any; colors: string[] }[] = [
  {
    key: 'classic',
    label: '经典白',
    desc: 'DeepTutor 风格，清爽克制',
    icon: Sun,
    colors: ['#ffffff', '#f2760c', '#2f6fd0', '#e9ebef'],
  },
  {
    key: 'tech',
    label: '深蓝科技',
    desc: '玻璃拟态 + 冷光数据舱',
    icon: Moon,
    colors: ['#050a14', '#38bdf8', '#fb923c', '#12213c'],
  },
  {
    key: 'fresh',
    label: '青蓝清新',
    desc: 'WorkBuddy 同行，明显偏青',
    icon: Waves,
    colors: ['#dcf0fa', '#0899c6', '#ff8424', '#ffffff'],
  },
  {
    key: 'pika',
    label: '皮卡丘黄',
    desc: '暖黄治愈，角色做淡化水印',
    icon: Zap,
    colors: ['#fffaea', '#f0a000', '#2f6fd0', '#fffdf4'],
  },
]

export function ThemeSwitcher() {
  const { settings, setTheme } = useApp()
  return (
    <div className="space-y-2">
      {THEMES.map((t) => {
        const Icon = t.icon
        const active = settings.theme === t.key
        return (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
              active
                ? 'border-primary bg-primary-soft/60 shadow-[var(--shadow-sm)]'
                : 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-panel-2'
            }`}
          >
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-inner"
              style={{ background: t.colors[0], border: '1px solid rgba(128,128,128,.18)' }}
            >
              <Icon size={15} style={{ color: t.colors[1] }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-ink">{t.label}</span>
                {active && <span className="rounded bg-primary px-1.5 py-[1px] text-[10px] text-white">当前</span>}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-mute">{t.desc}</span>
              <span className="mt-1.5 flex gap-1">
                {t.colors.map((c, i) => (
                  <span
                    key={i}
                    className="h-2.5 w-6 rounded-full ring-1 ring-black/5"
                    style={{ background: c }}
                  />
                ))}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================
   右侧栏：学习台
   ============================================================ */
export function RightPanel() {
  const { rightTab, setRightTab, activeDocId, settings } = useApp()
  const user = useAccount((s) => s.user)
  const [doc, setDoc] = useState<any>(null)
  const [facts, setFacts] = useState<any[]>([])
  const [synth, setSynth] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const d = activeDocId ? await db.docs.get(activeDocId) : null
      const f = await db.memoryFacts.toArray()
      const s = await db.memorySynthesis.toArray()
      const m = await db.modules.toArray()
      if (!alive) return
      setDoc(d)
      setFacts(f.sort((a, b) => b.createdAt - a.createdAt).slice(0, 12))
      setSynth(s.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5))
      setModules(m.sort((a, b) => a.order - b.order))
    }
    load()
    const t = setInterval(load, 3500)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [activeDocId, rightTab])

  const tabs = [
    { key: 'context' as const, label: '学习台', icon: Layers },
    { key: 'outline' as const, label: '大纲', icon: FileText },
    { key: 'memory' as const, label: '记忆', icon: Brain },
  ]

  return (
    <aside
      className="relative z-10 flex h-full flex-col border-l bg-[var(--panel-trans)] backdrop-blur-xl transition-[width] duration-200"
      style={{ width: settings.rightWidth }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <div className="flex gap-1 rounded-lg bg-panel-2 p-0.5">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setRightTab(t.key)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] transition ${
                  rightTab === t.key ? 'bg-panel text-ink shadow-[var(--shadow-sm)]' : 'text-ink-mute hover:text-ink'
                }`}
              >
                <Icon size={12} />
                {t.label}
              </button>
            )
          })}
        </div>
        <CollapseButton side="right" />
      </div>

      <div className="scroll-area min-h-0 flex-1 px-3 pb-4">
        {rightTab === 'context' && (
          <div className="space-y-3 animate-fade-up">
            <section className="card p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
                <ShieldCheck size={13} /> 账户与计费
              </h3>
              {user ? (
                <>
                  <p className="text-[12.5px] font-medium text-ink">{displayName(user)}</p>
                  <p className="mt-1.5 rounded-lg bg-good/10 px-2.5 py-2 text-[11px] leading-relaxed text-good">
                    已登录 WorkBuddy 账号 —— 当前模型调用<b>计入你自己的积分</b>，不消耗作品创建者额度。
                  </p>
                </>
              ) : (
                <>
                  <p className="rounded-lg bg-panel-2 px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
                    未登录时，模型调用<b>不会消耗任何人的积分</b>：只能使用「我自己的 API Key」或「演示模式」。
                    登录 WorkBuddy 账号后，调用自动计入你自己的积分。
                  </p>
                  <div className="mt-2">
                    <AccountChip compact />
                  </div>
                </>
              )}
            </section>

            <section className="card p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
                <BookOpen size={13} /> 当前资料
              </h3>
              {doc ? (
                <div>
                  <p className="truncate text-[13px] font-medium text-ink">{doc.name}</p>
                  <p className="mt-1 text-[11.5px] text-ink-mute">
                    {doc.kind?.toUpperCase()} · {doc.pages} 页 · {(doc.size / 1024).toFixed(0)} KB
                  </p>
                  <p className="mt-2 line-clamp-4 text-[11.5px] leading-relaxed text-ink-soft">{doc.preview}</p>
                </div>
              ) : (
                <p className="text-[11.5px] leading-relaxed text-ink-mute">
                  还没有选中资料。到「资料库」上传 PDF / Word / Markdown / 图片，或在「沉浸式阅读」中打开一份。
                </p>
              )}
            </section>

            <section className="card p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
                <Sparkles size={13} /> 成长进度
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="知识模块" value={modules.length} />
                <Stat label="已掌握" value={modules.filter((m) => m.status === 'mastered').length} />
                <Stat label="记忆条目" value={facts.length} />
                <Stat label="综合认知" value={synth.length} />
              </div>
              {modules.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {modules.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-[11.5px] text-ink-soft">{m.title}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                          style={{ width: `${Math.round((m.mastery ?? 0) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10.5px] text-ink-mute">
                        {Math.round((m.mastery ?? 0) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {rightTab === 'outline' && (
          <div className="space-y-2 animate-fade-up">
            {modules.length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-ink-mute">
                还没有学习模块。打开「星空成长」并对一份资料执行「水平诊断」，AI 会自动把它拆成若干知识模块。
              </p>
            ) : (
              modules.map((m, i) => (
                <div key={m.id} className="card p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary-soft text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-[12.5px] font-medium text-ink">{m.title}</span>
                    <span
                      className={`rounded px-1.5 py-[1px] text-[10px] ${
                        m.status === 'mastered'
                          ? 'bg-good/12 text-good'
                          : m.status === 'checked'
                            ? 'bg-primary-soft text-primary'
                            : m.status === 'digesting'
                              ? 'bg-warn/12 text-warn'
                              : 'bg-panel-2 text-ink-mute'
                      }`}
                    >
                      {m.status === 'mastered'
                        ? '已掌握'
                        : m.status === 'checked'
                          ? '已检验'
                          : m.status === 'digesting'
                            ? '消化中'
                            : '待开始'}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-ink-mute">
                    {m.outline?.slice(0, 120)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {rightTab === 'memory' && (
          <div className="space-y-3 animate-fade-up">
            <section className="card p-3">
              <h3 className="mb-2 text-[12px] font-medium text-ink-soft">综合认知 (L3)</h3>
              {synth.length === 0 ? (
                <p className="text-[11.5px] leading-relaxed text-ink-mute">
                  暂无综合认知。在「记忆库」里点击「重新综合」，AI 会把零散事实提炼成学习画像。
                </p>
              ) : (
                <ul className="space-y-2">
                  {synth.map((s) => (
                    <li key={s.id}>
                      <p className="text-[12px] font-medium text-ink">{s.title}</p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{s.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card p-3">
              <h3 className="mb-2 text-[12px] font-medium text-ink-soft">学习事实 (L2)</h3>
              {facts.length === 0 ? (
                <p className="text-[11.5px] leading-relaxed text-ink-mute">暂无事实记录。</p>
              ) : (
                <ul className="space-y-1.5">
                  {facts.map((f) => (
                    <li key={f.id} className="border-l-2 border-primary/40 pl-2 text-[11.5px] leading-relaxed text-ink-soft">
                      {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-panel-2 px-2 py-1.5">
      <p className="text-[16px] font-semibold leading-tight text-ink">{value}</p>
      <p className="mt-0.5 text-[10.5px] text-ink-mute">{label}</p>
    </div>
  )
}

import { db } from '../../lib/db'
