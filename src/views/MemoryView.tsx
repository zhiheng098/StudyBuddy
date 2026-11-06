import { useEffect, useState } from 'react'
import { Brain, Layers, Loader2, RefreshCw, Trash2, Pencil, Check, X } from 'lucide-react'
import { db } from '../lib/db'
import { synthesizeMemory } from '../lib/actions'
import { useApp } from '../store/app'

type Tab = 'L1' | 'L2' | 'L3'

const TAB_INFO: Record<Tab, { label: string; desc: string }> = {
  L1: { label: 'L1 原始轨迹', desc: '每一次提问、每一次阅读、每一道练习都被完整记录 —— 可溯源的原始证据' },
  L2: { label: 'L2 事实摘要', desc: '从轨迹中提炼出的原子事实：偏好、水平、薄弱点、目标 —— 可手动修正' },
  L3: { label: 'L3 跨面综合', desc: '把多条事实融成更高层的学习画像 —— 每次综合都会标注引用来源' },
}

export function MemoryView() {
  const { settings, notify } = useApp()
  const [tab, setTab] = useState<Tab>('L3')
  const [traces, setTraces] = useState<any[]>([])
  const [facts, setFacts] = useState<any[]>([])
  const [synth, setSynth] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const load = async () => {
    const [t, f, s] = await Promise.all([
      db.memoryTraces.orderBy('createdAt').reverse().limit(80).toArray(),
      db.memoryFacts.orderBy('createdAt').reverse().limit(80).toArray(),
      db.memorySynthesis.orderBy('createdAt').reverse().limit(20).toArray(),
    ])
    setTraces(t)
    setFacts(f)
    setSynth(s)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const rebuild = async () => {
    setLoading(true)
    try {
      const n = await synthesizeMemory(settings.llm)
      notify(n ? `已生成 ${n} 条综合认知` : '暂无可综合的事实', n ? 'good' : 'info')
      await load()
    } catch (e: any) {
      notify(e?.message ?? '综合失败', 'bad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-4xl px-6 py-7">
        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink">
              <Brain size={19} className="text-primary" />
              记忆库
            </h1>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-mute">
              三层可审计记忆：每条结论都能回溯到原始证据，你可以随时查看与修正，个性化不再是黑盒。
            </p>
          </div>
          <button
            onClick={rebuild}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-primary px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            重新综合
          </button>
        </header>

        {/* 分层 */}
        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {(Object.keys(TAB_INFO) as Tab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`card p-3.5 text-left transition ${
                tab === k ? 'border-primary bg-primary-soft/40 shadow-[var(--shadow-sm)]' : 'hover-lift'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <Layers size={13} className={tab === k ? 'text-primary' : 'text-ink-mute'} />
                  {TAB_INFO[k].label}
                </span>
                <span className="rounded bg-panel-2 px-1.5 py-[1px] text-[10.5px] text-ink-mute">
                  {k === 'L1' ? traces.length : k === 'L2' ? facts.length : synth.length}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">{TAB_INFO[k].desc}</p>
            </button>
          ))}
        </div>

        {/* 列表 */}
        <div className="mt-5">
          {tab === 'L1' && (
            <div className="space-y-1.5">
              {traces.length === 0 && <Empty text="还没有学习轨迹，去提问或练习就会自动积累" />}
              {traces.map((t) => (
                <div key={t.id} className="card flex items-start gap-3 p-3">
                  <span
                    className={`mt-0.5 rounded px-1.5 py-[2px] text-[10px] ${
                      t.kind === 'quiz'
                        ? 'bg-warn/12 text-warn'
                        : t.kind === 'read'
                          ? 'bg-primary-soft text-primary'
                          : t.kind === 'review'
                            ? 'bg-good/12 text-good'
                            : 'bg-panel-2 text-ink-mute'
                    }`}
                  >
                    {t.kind === 'quiz'
                      ? '练习'
                      : t.kind === 'read'
                        ? '阅读'
                        : t.kind === 'review'
                          ? '复习'
                          : t.kind === 'note'
                            ? '笔记'
                            : '对话'}
                  </span>
                  <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-soft">{t.summary}</p>
                  <span className="shrink-0 text-[10.5px] text-ink-mute">
                    {new Date(t.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'L2' && (
            <div className="space-y-1.5">
              {facts.length === 0 && <Empty text="还没有提炼出事实，先多聊几句" />}
              {facts.map((f) => (
                <div key={f.id} className="card p-3">
                  {editing === f.id ? (
                    <div className="flex gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        className="flex-1 resize-none rounded-lg border bg-panel-2 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary/50"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={async () => {
                            await db.memoryFacts.update(f.id, { text: draft, edited: true })
                            setEditing(null)
                            load()
                          }}
                          className="rounded-lg bg-good/12 p-1.5 text-good transition hover:bg-good/20"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded-lg bg-panel-2 p-1.5 text-ink-mute transition hover:text-danger"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="rounded bg-primary-soft px-1.5 py-[2px] text-[10px] text-primary">
                        {f.category}
                      </span>
                      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-soft">{f.text}</p>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          onClick={() => {
                            setEditing(f.id)
                            setDraft(f.text)
                          }}
                          className="rounded p-1 text-ink-mute transition hover:bg-panel-2 hover:text-ink"
                          title="修正"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={async () => {
                            await db.memoryFacts.delete(f.id)
                            load()
                          }}
                          className="rounded p-1 text-ink-mute transition hover:bg-danger/10 hover:text-danger"
                          title="删除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                  {f.source && (
                    <p className="mt-1.5 pl-1 text-[10.5px] text-ink-mute">来源：{f.source}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'L3' && (
            <div className="space-y-2.5">
              {synth.length === 0 && (
                <Empty text="还没有综合认知，点击右上角「重新综合」生成你的学习画像" />
              )}
              {synth.map((s) => (
                <div key={s.id} className="card p-4">
                  <p className="text-[13px] font-medium text-ink">{s.title}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{s.text}</p>
                  {s.refFactIds?.length > 0 && (
                    <p className="mt-2 text-[10.5px] text-ink-mute">
                      引用 {s.refFactIds.length} 条事实 · {new Date(s.createdAt).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed py-12 text-center text-[12.5px] text-ink-mute">{text}</div>
  )
}
