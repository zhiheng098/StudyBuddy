import { memo, useEffect, useId, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import { AlertTriangle, Check, Copy } from 'lucide-react'

/* ---------------- Mermaid 渲染 ---------------- */
function MermaidBlock({ code }: { code: string }) {
  const id = useId().replace(/[:]/g, '')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const mermaid: any = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.getAttribute('data-theme') === 'tech' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
        })
        const { svg: out } = await mermaid.render(`mmd_${id}`, code)
        if (alive) setSvg(out)
      } catch (e: any) {
        if (alive) setError(e?.message ?? '图表渲染失败')
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [code, id])

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border bg-[var(--panel-2)] p-3">
      {error ? (
        <div className="flex items-start gap-2 text-[12px] text-warn">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>图表语法有误：{error}</span>
        </div>
      ) : svg ? (
        <div
          className="flex justify-center overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex items-center gap-2 text-[12px] text-ink-mute">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          正在绘制图表…
        </div>
      )}
      <button
        onClick={() => {
          navigator.clipboard?.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="absolute right-2 top-2 rounded-md bg-[var(--panel)] p-1.5 text-ink-mute opacity-0 transition group-hover:opacity-100 hover:text-ink"
        title="复制图表源码"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

/* ---------------- 代码块 ---------------- */
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group relative my-3">
      {lang && (
        <div className="absolute left-3 top-2 z-10 rounded bg-[var(--panel)] px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-ink-mute">
          {lang}
        </div>
      )}
      <button
        onClick={() => {
          navigator.clipboard?.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="absolute right-2.5 top-2 z-10 rounded-md bg-[var(--panel)] p-1.5 text-ink-mute opacity-0 transition group-hover:opacity-100 hover:text-ink"
        title="复制代码"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <pre>
        <code className={lang ? `language-${lang}` : undefined}>{code}</code>
      </pre>
    </div>
  )
}

/* ---------------- 主组件 ---------------- */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="prose-sb">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const text = String(children).replace(/\n$/, '')
            if (match?.[1] === 'mermaid') return <MermaidBlock code={text} />
            if (!inline && !match) return <CodeBlock code={text} />
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          a({ href, children, ...props }: any) {
            return (
              <a href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            )
          },
          table({ children, ...props }: any) {
            return (
              <div className="my-3 overflow-x-auto">
                <table {...props}>{children}</table>
              </div>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
