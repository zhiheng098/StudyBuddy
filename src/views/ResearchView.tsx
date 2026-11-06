import { useEffect, useState } from 'react'
import {
  BookMarked,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { searchPapers } from '../lib/academic'
import { db } from '../lib/db'
import { useApp } from '../store/app'
import type { Paper } from '../types'

export function ResearchView() {
  const { setView, notify, setPendingPrompt } = useApp()
  const [q, setQ] = useState('')
  const [papers, setPapers] = useState<Paper[]>([])
  const [saved, setSaved] = useState<Paper[]>([])
  const [loading, setLoading] = useState(false)

  const loadSaved = async () => {
    setSaved(await db.papers.orderBy('title').toArray())
  }
  useEffect(() => {
    loadSaved()
  }, [])

  const search = async () => {
    const query = q.trim()
    if (!query) return
    setLoading(true)
    try {
      const res = await searchPapers(query, 12)
      setPapers(res)
      if (!res.length) notify('没有检索到文献，换个关键词试试', 'info')
    } catch (e: any) {
      notify(e?.message ?? '检索失败（可能是网络受限）', 'bad')
    } finally {
      setLoading(false)
    }
  }

  const toggleSave = async (p: Paper) => {
    const exists = saved.find((x) => x.id === p.id)
    if (exists) {
      await db.papers.delete(p.id)
      notify('已取消收藏')
    } else {
      await db.papers.put(p)
      notify('已收藏到文献库', 'good')
    }
    loadSaved()
  }

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-4xl px-6 py-7">
        <header>
          <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink">
            <BookMarked size={19} className="text-primary" />
            文献调研
          </h1>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-mute">
            接入 Semantic Scholar 与 OpenAlex 两大免费学术索引（覆盖 arXiv 论文），检索真实文献而非模型编造。
          </p>
        </header>

        {/* 检索 */}
        <div className="card mt-5 flex items-center gap-2 p-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="输入研究主题，例如：diffusion model sampling / 注意力机制 综述"
              className="w-full rounded-xl border bg-panel-2 py-2.5 pl-9 pr-3 text-[13px] outline-none transition focus:border-primary/50"
            />
          </div>
          <button
            onClick={search}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent to-primary px-4 py-2.5 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            检索
          </button>
        </div>

        {/* 结果 */}
        {papers.length > 0 && (
          <div className="mt-5 space-y-2.5">
            <h2 className="text-[13px] font-medium text-ink-soft">检索结果（{papers.length}）</h2>
            {papers.map((p) => {
              const isSaved = saved.some((x) => x.id === p.id)
              return (
                <div key={p.id} className="card group p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13.5px] font-medium leading-snug text-ink underline-offset-2 hover:text-primary hover:underline"
                      >
                        {p.title}
                        <ExternalLink size={11} className="ml-1 inline" />
                      </a>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-mute">
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {p.authors?.slice(0, 60) || '未知作者'}
                        </span>
                        {p.year && <span>· {p.year}</span>}
                        {p.venue && <span>· {p.venue}</span>}
                        {p.citations != null && <span>· 被引 {p.citations}</span>}
                      </p>
                      {p.abstract && (
                        <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-ink-soft">
                          {p.abstract}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleSave(p)}
                      className={`shrink-0 rounded-lg p-1.5 transition ${
                        isSaved
                          ? 'bg-accent-soft text-accent'
                          : 'text-ink-mute opacity-0 hover:bg-panel-2 hover:text-ink group-hover:opacity-100'
                      }`}
                      title={isSaved ? '取消收藏' : '收藏'}
                    >
                      <BookMarked size={14} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => {
                        setPendingPrompt(
                          `请帮我精读这篇论文并总结它的核心贡献：\n标题：${p.title}\n作者：${p.authors}\n摘要：${p.abstract ?? '（无摘要）'}\n链接：${p.url ?? ''}\n\n我想知道：它解决了什么问题、方法的关键创新、以及我应该从哪一节开始读。`,
                        )
                        setView('chat')
                      }}
                      className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] text-ink-soft transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                    >
                      <Sparkles size={11} />
                      让 AI 精读
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 收藏 */}
        <div className="mt-7">
          <h2 className="mb-2.5 text-[13px] font-medium text-ink-soft">
            我的文献库 {saved.length > 0 && `(${saved.length})`}
          </h2>
          {saved.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-[12.5px] text-ink-mute">
              还没有收藏的文献
            </div>
          ) : (
            <div className="space-y-2">
              {saved.map((p) => (
                <div key={p.id} className="card group flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[12.5px] text-ink hover:text-primary"
                    >
                      {p.title}
                    </a>
                    <p className="mt-0.5 text-[11px] text-ink-mute">
                      {p.authors?.split(',')[0]} {p.year ? `· ${p.year}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await db.papers.delete(p.id)
                      loadSaved()
                    }}
                    className="rounded p-1 text-ink-mute opacity-0 transition hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
