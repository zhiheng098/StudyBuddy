import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Search } from 'lucide-react'

export interface SelectionPayload {
  text: string
  page: number
  rect: { top: number; left: number; width: number; height: number }
}

/* ---------------- 文本测量（用于水平缩放对齐） ---------------- */
const measureCanvas = document.createElement('canvas')
const measureCtx = measureCanvas.getContext('2d')!

export function PdfReader({
  blob,
  docName,
  onSelect,
  currentPage,
  onPageChange,
}: {
  blob: Blob
  docName: string
  onSelect?: (payload: SelectionPayload) => void
  currentPage?: number
  onPageChange?: (p: number) => void
}) {
  const [pages, setPages] = useState<{ num: number; width: number; height: number }[]>([])
  const [scale, setScale] = useState(1.15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const pdfRef = useRef<any>(null)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())

  /* ---- 加载 PDF ---- */
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const pdfjs: any = await import('pdfjs-dist')
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const buf = await blob.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: buf }).promise
        if (!alive) return
        pdfRef.current = pdf
        const first = await pdf.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        const ratio = Math.min(1.15, 860 / vp.width)
        setScale(ratio)
        const arr: { num: number; width: number; height: number }[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const p = await pdf.getPage(i)
          const v = p.getViewport({ scale: ratio })
          arr.push({ num: i, width: v.width, height: v.height })
        }
        if (alive) {
          setPages(arr)
          setLoading(false)
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message ?? 'PDF 解析失败')
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [blob])

  /* ---- 渲染单页（画布 + 文本层） ---- */
  const renderPage = useCallback(
    async (num: number) => {
      const pdf = pdfRef.current
      const holder = pageRefs.current[num - 1]
      if (!pdf || !holder || holder.dataset.rendered === '1') return
      const page = await pdf.getPage(num)
      const viewport = page.getViewport({ scale })
      const canvas = holder.querySelector('canvas') as HTMLCanvasElement | null
      const layer = holder.querySelector('.pdf-text-layer') as HTMLDivElement | null
      if (!canvas || !layer) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      await page.render({ canvasContext: ctx, viewport, canvas }).promise

      /* 文本层 */
      const tc = await page.getTextContent()
      const pdfjs: any = await import('pdfjs-dist')
      layer.innerHTML = ''
      const frag = document.createDocumentFragment()
      for (const item of tc.items as any[]) {
        if (typeof item.str !== 'string' || !item.str.length) continue
        const tx = pdfjs.Util.transform(viewport.transform, item.transform)
        const fontHeight = Math.hypot(tx[2], tx[1])
        if (!fontHeight || !isFinite(fontHeight)) continue
        const span = document.createElement('span')
        span.textContent = item.str
        const left = tx[4]
        const top = tx[5] - fontHeight
        span.style.left = `${left}px`
        span.style.top = `${top}px`
        span.style.fontSize = `${fontHeight}px`
        span.style.fontFamily = 'sans-serif'
        measureCtx.font = `${fontHeight}px sans-serif`
        const natural = measureCtx.measureText(item.str).width
        const target = (item.width ?? 0) * scale
        const k = natural > 0 ? target / natural : 1
        span.style.transform = `scaleX(${k})`
        span.style.transformOrigin = '0 0'
        frag.appendChild(span)
        if (item.hasEOL) {
          const br = document.createElement('span')
          br.style.display = 'block'
          br.style.height = '0'
          frag.appendChild(br)
        }
      }
      layer.appendChild(frag)
      holder.dataset.rendered = '1'
      setRenderedPages((s) => new Set(s).add(num))
    },
    [scale],
  )

  /* ---- 缩放变化时重绘 ---- */
  useEffect(() => {
    const holders = pageRefs.current
    holders.forEach((h) => {
      if (h) delete h.dataset.rendered
    })
    setRenderedPages(new Set())
    pages.forEach((p) => renderPage(p.num))
  }, [scale, pages, renderPage])

  /* ---- 懒渲染可视页面 ---- */
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const n = Number((e.target as HTMLElement).dataset.page)
          if (n) renderPage(n)
        })
      },
      { root, rootMargin: '400px 0px' },
    )
    pageRefs.current.forEach((h) => h && io.observe(h))
    return () => io.disconnect()
  }, [pages, renderPage])

  /* ---- 选区捕获 ---- */
  useEffect(() => {
    if (!onSelect) return
    const handler = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return
      const anchorNode = sel.anchorNode
      const el = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement
      const layer = el?.closest?.('.pdf-text-layer') as HTMLElement | null
      if (!layer) return
      const pageEl = layer.closest('[data-page]') as HTMLElement | null
      const page = Number(pageEl?.dataset.page ?? 1)
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      onSelect({
        text: sel.toString().trim(),
        page,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      })
    }
    document.addEventListener('mouseup', handler)
    return () => document.removeEventListener('mouseup', handler)
  }, [onSelect])

  /* ---- 滚动定位 ---- */
  useEffect(() => {
    if (!currentPage) return
    const el = pageRefs.current[currentPage - 1]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentPage])

  const pageCount = pages.length
  const shown = currentPage ?? 1

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-[12.5px] text-ink-mute">
          <Loader2 size={15} className="animate-spin" />
          正在解析 PDF…
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-[12.5px] text-danger">{error}</div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 工具条 */}
      <div className="flex shrink-0 items-center gap-2 border-b bg-[var(--panel-trans)] px-3 py-1.5 backdrop-blur">
        <span className="flex items-center gap-1 text-[11.5px] text-ink-mute">
          <Search size={12} />
          {docName}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            className="rounded p-1 text-ink-mute transition hover:bg-panel-2 hover:text-ink"
            title="缩小"
          >
            <Minus size={13} />
          </button>
          <span className="w-10 text-center text-[11px] text-ink-mute">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(2.4, s + 0.15))}
            className="rounded p-1 text-ink-mute transition hover:bg-panel-2 hover:text-ink"
            title="放大"
          >
            <Plus size={13} />
          </button>
          <div className="mx-1 h-4 w-px bg-[var(--border)]" />
          <button
            onClick={() => onPageChange?.(Math.max(1, shown - 1))}
            className="rounded p-1 text-ink-mute transition hover:bg-panel-2 hover:text-ink"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[11px] text-ink-mute">
            {shown} / {pageCount}
          </span>
          <button
            onClick={() => onPageChange?.(Math.min(pageCount, shown + 1))}
            className="rounded p-1 text-ink-mute transition hover:bg-panel-2 hover:text-ink"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* 页面 */}
      <div ref={containerRef} className="scroll-area min-h-0 flex-1 bg-[var(--bg-soft)] px-4 py-4">
        <div className="mx-auto flex flex-col items-center gap-4">
          {pages.map((p) => (
            <div
              key={p.num}
              ref={(el) => {
                pageRefs.current[p.num - 1] = el
              }}
              data-page={p.num}
              className="pdf-page shadow-[var(--shadow)] ring-1 ring-black/5"
              style={{ width: p.width, height: p.height }}
            >
              <canvas />
              <div className="pdf-text-layer" />
              {!renderedPages.has(p.num) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[11px] text-gray-400">
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  渲染中…
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
