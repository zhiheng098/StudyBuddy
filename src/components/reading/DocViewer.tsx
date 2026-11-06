import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import type { DocRecord } from '../../types'
import type { SelectionPayload } from './PdfReader'

/** 通用文本选区捕获（用于 docx / markdown / 纯文本） */
export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  onSelect?: (p: SelectionPayload) => void,
) {
  useEffect(() => {
    if (!onSelect) return
    const handler = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return
      const node = sel.anchorNode
      const el = node instanceof Element ? node : node?.parentElement
      const container = containerRef.current
      if (!el || !container || !container.contains(el)) return
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      onSelect({
        text: sel.toString().trim(),
        page: 1,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      })
    }
    document.addEventListener('mouseup', handler)
    return () => document.removeEventListener('mouseup', handler)
  }, [containerRef, onSelect])
}

export function DocViewer({
  doc,
  html,
  onSelect,
}: {
  doc: DocRecord
  html?: string
  onSelect?: (p: SelectionPayload) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useTextSelection(ref, onSelect)

  if (doc.kind === 'image') {
    return (
      <div className="scroll-area flex h-full flex-col items-center justify-center gap-3 bg-[var(--bg-soft)] p-6">
        {doc.imageDataUrl && (
          <img
            src={doc.imageDataUrl}
            alt={doc.name}
            className="max-h-[70%] max-w-full rounded-xl shadow-[var(--shadow)] ring-1 ring-black/5"
          />
        )}
        <p className="flex items-center gap-1.5 text-[12px] text-ink-mute">
          <ImageIcon size={13} />
          图片型资料 · 可直接提问，AI 会用视觉模型解析图中内容
        </p>
        <p className="flex items-center gap-1.5 text-[11.5px] text-ink-mute">
          <Sparkles size={12} />
          提示：配置支持视觉的模型后效果最佳
        </p>
      </div>
    )
  }

  return (
    <div ref={ref} className="scroll-area h-full bg-[var(--bg-soft)] px-6 py-6">
      <article className="mx-auto max-w-3xl rounded-xl border bg-[var(--panel)] px-8 py-8 shadow-[var(--shadow-sm)]">
        <h1 className="mb-5 border-b pb-3 text-[19px] font-semibold text-ink">{doc.name}</h1>
        {doc.kind === 'docx' && html ? (
          <div
            className="prose-sb"
            dangerouslySetInnerHTML={{ __html: sanitize(html) }}
          />
        ) : (
          <div className="prose-sb">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {doc.text}
            </ReactMarkdown>
          </div>
        )}
      </article>
    </div>
  )
}

/** 极简清洗：移除 script / on* 事件属性 */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}
