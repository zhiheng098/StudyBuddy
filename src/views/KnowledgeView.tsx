import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import { Loader2, Network, Search, Sparkles, X } from 'lucide-react'
import { db } from '../lib/db'
import { useApp } from '../store/app'
import type { KnowledgeEdge, KnowledgeNode } from '../types'

const TYPE_COLOR: Record<string, string> = {
  concept: 'var(--primary)',
  formula: 'var(--accent)',
  code: 'var(--good)',
  method: '#a855f7',
  entity: '#0ea5c4',
  example: 'var(--warn)',
}

const TYPE_LABEL: Record<string, string> = {
  concept: '概念',
  formula: '公式',
  code: '代码',
  method: '方法',
  entity: '实体',
  example: '例子',
}

interface SimNode extends KnowledgeNode {
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}
interface SimEdge extends Omit<KnowledgeEdge, 'source' | 'target'> {
  source: SimNode | string
  target: SimNode | string
}

const FALLBACK_W = 900
const FALLBACK_H = 620

export function KnowledgeView() {
  const { setView, setPendingPrompt } = useApp()
  const [nodes, setNodes] = useState<KnowledgeNode[]>([])
  const [edges, setEdges] = useState<KnowledgeEdge[]>([])
  const [selected, setSelected] = useState<KnowledgeNode | null>(null)
  const [q, setQ] = useState('')
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [loading, setLoading] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<any>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: FALLBACK_W, h: FALLBACK_H })

  /* 画布尺寸跟随容器，保证 1 单位 = 1 像素，节点清晰可读 */
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      if (r.width > 100 && r.height > 100) setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const load = async () => {
      const [n, e] = await Promise.all([db.knowledge.toArray(), db.edges.toArray()])
      setNodes(n)
      setEdges(e)
      setLoading(false)
    }
    load()
  }, [])

  /* ---- 力导向布局 ---- */
  const filtered = useMemo(() => {
    if (!q.trim()) return nodes
    const k = q.toLowerCase()
    return nodes.filter((n) => n.name.toLowerCase().includes(k) || n.summary.toLowerCase().includes(k))
  }, [nodes, q])

  useEffect(() => {
    if (!filtered.length) return
    const simNodes: SimNode[] = filtered.map((n) => ({ ...n }))
    const ids = new Set(simNodes.map((n) => n.id))
    const simEdges: SimEdge[] = edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ ...e, source: e.source, target: e.target }))

    const W = size.w
    const H = size.h
    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-520) as any)
      .force('link', forceLink(simEdges as any).id((d: any) => d.id).distance(110).strength(0.4) as any)
      .force('center', forceCenter(W / 2, H / 2))
      .force('x', forceX(W / 2).strength(0.04) as any)
      .force('y', forceY(H / 2).strength(0.06) as any)

    sim.on('tick', () => {
      const map: Record<string, { x: number; y: number }> = {}
      simNodes.forEach((n) => {
        const x = Math.max(34, Math.min(W - 34, n.x ?? W / 2))
        const y = Math.max(34, Math.min(H - 34, n.y ?? H / 2))
        map[n.id] = { x, y }
      })
      setPositions(map)
    })
    sim.alpha(1).restart()
    sim.alpha(1).restart()
    simRef.current = sim
    return () => {
      sim.stop()
    }
  }, [filtered, edges, size.w, size.h])

  const related = useMemo(() => {
    if (!selected) return []
    const out = edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((e) => {
        const otherId = e.source === selected.id ? e.target : e.source
        return { edge: e, node: nodes.find((n) => n.id === otherId) }
      })
      .filter((x) => x.node)
    return out as { edge: KnowledgeEdge; node: KnowledgeNode }[]
  }, [selected, edges, nodes])

  const nodePos = (id: string) => positions[id] ?? { x: size.w / 2, y: size.h / 2 }
  const degree = (id: string) => edges.filter((e) => e.source === id || e.target === id).length

  return (
    <div className="flex h-full min-h-0">
      <div className="scroll-area min-h-0 flex-1">
        <div className="px-6 py-6">
          <header className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-[20px] font-semibold tracking-tight text-ink">知识图谱</h1>
              <p className="mt-1 text-[12.5px] text-ink-mute">
                {nodes.length} 个知识点 · {edges.length} 条关系 · 随你的提问自动生长
              </p>
            </div>
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索知识点…"
                className="w-56 rounded-xl border bg-[var(--panel)] py-2 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-primary/50"
              />
            </div>
          </header>

          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(TYPE_LABEL).map(([k, label]) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] text-ink-mute">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[k] }} />
                {label}
              </span>
            ))}
          </div>

          <div ref={boxRef} className="card relative mt-3 overflow-hidden">
            {loading ? (
              <div className="flex h-[520px] items-center justify-center">
                <Loader2 size={18} className="animate-spin text-ink-mute" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-[520px] flex-col items-center justify-center gap-2">
                <Network size={24} className="text-ink-mute" />
                <p className="text-[12.5px] text-ink-mute">
                  还没有知识点。在阅读器里选中一段内容点「记入图谱」，或直接提问即可自动沉淀。
                </p>
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${size.w} ${size.h}`}
                className="h-[560px] w-full"
                onClick={() => setSelected(null)}
              >
                {/* 连线 */}
                {edges
                  .filter((e) => positions[e.source] && positions[e.target])
                  .map((e) => {
                    const a = nodePos(e.source)
                    const b = nodePos(e.target)
                    const active = selected && (e.source === selected.id || e.target === selected.id)
                    return (
                      <line
                        key={e.id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={active ? 'var(--primary)' : 'var(--border-strong)'}
                        strokeWidth={active ? 1.8 : 1}
                        strokeDasharray={e.type === 'prerequisite' ? '4 3' : undefined}
                        opacity={active ? 0.9 : 0.45}
                      />
                    )
                  })}
                {/* 节点 */}
                {filtered.map((n) => {
                  const p = nodePos(n.id)
                  const r = 6 + Math.min(11, n.mentions * 1.6) + (n.mastery > 0.6 ? 3 : 0)
                  const active = selected?.id === n.id
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x},${p.y})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(n)
                      }}
                    >
                      {active && <circle r={r + 6} fill={TYPE_COLOR[n.type]} opacity={0.16} />}
                      <circle
                        r={r}
                        fill={TYPE_COLOR[n.type]}
                        opacity={0.9}
                        stroke="var(--panel)"
                        strokeWidth={active ? 2.5 : 1.5}
                      />
                      <text
                        y={r + 13}
                        textAnchor="middle"
                        fontSize={active ? 12.5 : 11}
                        fontWeight={active ? 600 : 400}
                        fill={active ? 'var(--text)' : 'var(--text-soft)'}
                        style={{ pointerEvents: 'none' }}
                      >
                        {n.name.length > 14 ? `${n.name.slice(0, 14)}…` : n.name}
                      </text>
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* 详情面板 */}
      {selected && (
        <div className="scroll-area w-[320px] shrink-0 border-l bg-[var(--panel-trans)] p-4 backdrop-blur">
          <div className="flex items-start justify-between">
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: `color-mix(in srgb, ${TYPE_COLOR[selected.type]} 14%, transparent)`,
                color: TYPE_COLOR[selected.type],
              }}
            >
              {TYPE_LABEL[selected.type]}
            </span>
            <button
              onClick={() => setSelected(null)}
              className="rounded p-1 text-ink-mute transition hover:bg-panel-2 hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
          <h2 className="mt-2.5 text-[15px] font-semibold text-ink">{selected.name}</h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{selected.summary || '暂无摘要'}</p>

          <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-panel-2 px-2 py-1.5">
              <dt className="text-ink-mute">出现次数</dt>
              <dd className="mt-0.5 text-[13px] font-semibold text-ink">{selected.mentions}</dd>
            </div>
            <div className="rounded-lg bg-panel-2 px-2 py-1.5">
              <dt className="text-ink-mute">连接数</dt>
              <dd className="mt-0.5 text-[13px] font-semibold text-ink">{degree(selected.id)}</dd>
            </div>
            <div className="col-span-2 rounded-lg bg-panel-2 px-2 py-1.5">
              <dt className="text-ink-mute">掌握度</dt>
              <dd className="mt-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{ width: `${Math.round(selected.mastery * 100)}%` }}
                  />
                </div>
              </dd>
            </div>
          </dl>

          {selected.docName && (
            <p className="mt-3 text-[11px] text-ink-mute">
              出处：{selected.docName}
              {selected.page ? ` · 第 ${selected.page} 页` : ''}
            </p>
          )}

          <div className="mt-4 space-y-1.5">
            <button
              onClick={() => {
                setPendingPrompt(`请详细讲解「${selected.name}」，并结合我的资料举例。`)
                setView('chat')
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-primary py-2 text-[12px] font-medium text-white transition hover:brightness-110"
            >
              <Sparkles size={12} />
              深入讲解这个知识点
            </button>
            <button
              onClick={() => {
                setPendingPrompt(`请围绕「${selected.name}」给我出 3 道题并讲解答案。`)
                setView('chat')
              }}
              className="w-full rounded-lg border py-2 text-[12px] text-ink-soft transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
            >
              针对它出题
            </button>
          </div>

          {related.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-[12px] font-medium text-ink-soft">关联知识点</h3>
              <ul className="space-y-1.5">
                {related.map(({ edge, node }) => (
                  <li key={edge.id}>
                    <button
                      onClick={() => setSelected(node)}
                      className="w-full rounded-lg border bg-panel-2 px-2.5 py-2 text-left transition hover:border-primary/40"
                    >
                      <span className="flex items-center gap-1.5 text-[11.5px] text-ink">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: TYPE_COLOR[node.type] }}
                        />
                        {node.name}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-ink-mute">
                        {edge.type === 'prerequisite'
                          ? '前置知识'
                          : edge.type === 'related'
                            ? '相关概念'
                            : edge.type === 'contains'
                              ? '包含'
                              : edge.type === 'example'
                                ? '示例'
                                : '对比'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
