import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  BookOpen,
  Brain,
  ChevronDown,
  ClipboardList,
  Loader2,
  MessageSquare,
  Quote,
  Search,
  Sparkles,
  Square,
  Wand2,
  X,
} from 'lucide-react'
import { db, uid } from '../../lib/db'
import { sendChatMessage, extractKnowledge } from '../../lib/actions'
import type { ChatMessage, SelectionContext, StudyMode } from '../../types'
import { useApp } from '../../store/app'
import { Markdown } from '../Markdown'

const MODES: { key: StudyMode; label: string; icon: any; hint: string }[] = [
  { key: 'chat', label: '答疑', icon: MessageSquare, hint: '自由追问，基于文档与上下文' },
  { key: 'explain', label: '深读', icon: BookOpen, hint: '逐句拆解选中的内容' },
  { key: 'solve', label: '解题', icon: Wand2, hint: '拆解思路 + 完整解答' },
  { key: 'quiz', label: '出题', icon: ClipboardList, hint: '基于学过的内容生成练习' },
  { key: 'research', label: '调研', icon: Search, hint: '结构化研究报告' },
  { key: 'visualize', label: '可视化', icon: Sparkles, hint: '图表 / 动画 / 交互演示' },
]

export interface ChatPanelProps {
  conversationId: string | null
  onNeedConversation?: () => string | Promise<string>
  /** 来自阅读器的选区 */
  selection?: SelectionContext | null
  onClearSelection?: () => void
  docId?: string
  className?: string
  emptyState?: React.ReactNode
  /** 是否显示模式切换 */
  showModes?: boolean
}

export function ChatPanel({
  conversationId,
  onNeedConversation,
  selection,
  onClearSelection,
  docId,
  className = '',
  emptyState,
  showModes = true,
}: ChatPanelProps) {
  const { settings, notify } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<StudyMode>('chat')
  const [streaming, setStreaming] = useState('')
  const [generating, setGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!conversationId) {
        setMessages([])
        return
      }
      const list = await db.messages.where('conversationId').equals(conversationId).toArray()
      if (!alive) return
      // 与本地乐观消息合并，避免竞态导致刚发出的消息被覆盖为空
      setMessages((prev) => {
        const map = new Map<string, ChatMessage>()
        prev.forEach((m) => map.set(m.id, m))
        list.forEach((m) => map.set(m.id, m))
        return [...map.values()].sort((a, b) => a.createdAt - b.createdAt)
      })
    }
    load()
    return () => {
      alive = false
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, streaming])

  const autoGrow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = '0px'
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`
  }

  const send = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim()
      if (!text || generating) return
      setInput('')
      setTimeout(autoGrow, 0)

      let cid = conversationId
      if (!cid && onNeedConversation) {
        cid = await onNeedConversation()
      }
      if (!cid) return

      setGenerating(true)
      setStreaming('')
      const controller = new AbortController()
      abortRef.current = controller

      const userMsg: ChatMessage = {
        id: uid('msg_'),
        conversationId: cid,
        role: 'user',
        content: text,
        createdAt: Date.now(),
        selection: selection ?? undefined,
        mode,
      }
      setMessages((m) => [...m, userMsg])

      try {
        const full = await sendChatMessage(settings.llm, {
          text,
          conversationId: cid,
          mode,
          selection: selection ?? undefined,
          docId,
          persona: settings.persona || undefined,
          signal: controller.signal,
          onDelta: (d) => setStreaming((s) => s + d),
        })
        setMessages((m) => [
          ...m,
          {
            id: uid('msg_'),
            conversationId: cid,
            role: 'assistant',
            content: full,
            createdAt: Date.now(),
            mode,
            selection: selection ?? undefined,
          },
        ])
        setStreaming('')
        onClearSelection?.()

        // 后台沉淀知识点（不阻塞界面）
        if (selection?.text && settings.llm.channel !== 'demo') {
          extractKnowledge(settings.llm, {
            docId: selection.docId,
            docName: selection.docName,
            text: selection.text,
            page: selection.page,
          }).catch(() => undefined)
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          const msg = e?.message ?? '请求失败'
          notify(msg, 'bad')
          setMessages((m) => [
            ...m,
            {
              id: uid('msg_'),
              conversationId: cid,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              error: msg,
              mode,
            },
          ])
        }
        setStreaming('')
      } finally {
        setGenerating(false)
        abortRef.current = null
      }
    },
    [
      input,
      generating,
      conversationId,
      onNeedConversation,
      selection,
      mode,
      settings,
      docId,
      notify,
      onClearSelection,
    ],
  )

  const sendRef = useRef(send)
  sendRef.current = send

  const stop = () => {
    abortRef.current?.abort()
    setGenerating(false)
    setStreaming('')
  }

  /* ---- 阅读器工具条 / 跨视图跳转触发的自动提问 ---- */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string
      if (!detail) return
      sendRef.current(detail)
    }
    window.addEventListener('sb:ask', handler)
    return () => window.removeEventListener('sb:ask', handler)
  }, [])

  const quickAsk = (prompt: string) => {
    setInput(prompt)
    taRef.current?.focus()
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      {/* 消息区 */}
      <div ref={scrollRef} className="scroll-area min-h-0 flex-1 px-4 py-4">
        {messages.length === 0 && !streaming ? (
          emptyState ?? <EmptyChat onQuickAsk={quickAsk} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onDelete={() => db.messages.delete(m.id)} />
            ))}
            {streaming && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <Loader2 size={14} className="animate-spin text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <Markdown content={streaming} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 px-4 pb-4">
        <div className="mx-auto max-w-3xl">
          {selection && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft/60 px-3 py-2 animate-fade-up">
              <Quote size={13} className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-primary">
                  {selection.docName}
                  {selection.page ? ` · 第 ${selection.page} 页` : ''}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-soft">{selection.text}</p>
              </div>
              <button onClick={onClearSelection} className="rounded p-0.5 text-ink-mute hover:text-danger">
                <X size={13} />
              </button>
            </div>
          )}

          <div className="rounded-2xl border bg-[var(--panel)] shadow-[var(--shadow)] transition focus-within:border-primary/50">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                autoGrow()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder="问我任何问题…（Enter 发送，Shift+Enter 换行）"
              className="scroll-area max-h-[220px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[13.5px] leading-relaxed outline-none placeholder:text-ink-mute"
            />
            <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
              {showModes && (
                <div className="relative">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as StudyMode)}
                    className="cursor-pointer appearance-none rounded-lg border bg-panel-2 py-1.5 pl-2.5 pr-7 text-[12px] text-ink-soft outline-none transition hover:border-primary/40"
                  >
                    {MODES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute" />
                </div>
              )}
              <span className="hidden text-[11px] text-ink-mute sm:inline">
                {MODES.find((m) => m.key === mode)?.hint}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {generating ? (
                  <button
                    onClick={stop}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border bg-panel-2 text-ink-soft transition hover:text-danger"
                    title="停止生成"
                  >
                    <Square size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => send()}
                    disabled={!input.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary text-white shadow-[var(--shadow-sm)] transition disabled:opacity-40 enabled:hover:brightness-110"
                    title="发送"
                  >
                    <ArrowUp size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[10.5px] text-ink-mute">
            AI 输出可能存在偏差，重要结论请核对原文出处
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 消息气泡 ---------------- */
function MessageBubble({ message, onDelete }: { message: ChatMessage; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  return (
    <div className="group flex gap-3 animate-fade-up">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          isUser ? 'bg-primary-soft text-primary' : 'bg-gradient-to-br from-accent to-primary text-white'
        }`}
      >
        {isUser ? '我' : 'AI'}
      </div>
      <div className="min-w-0 flex-1">
        {message.selection && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-ink-mute">
            <Quote size={11} />
            引用自 {message.selection.docName}
            {message.selection.page ? ` · 第${message.selection.page}页` : ''}
          </div>
        )}
        {message.reasoning && (
          <details className="mb-2 rounded-lg border bg-[var(--panel-2)] px-3 py-2">
            <summary className="cursor-pointer text-[11.5px] text-ink-mute select-none">
              查看模型思考过程
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-soft">
              {message.reasoning.slice(0, 4000)}
            </p>
          </details>
        )}
        {message.reasoning && (
          <details className="mb-2 rounded-lg border bg-[var(--panel-2)] px-3 py-2">
            <summary className="cursor-pointer text-[11.5px] text-ink-mute select-none">
              查看模型思考过程
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-soft">
              {message.reasoning.slice(0, 4000)}
            </p>
          </details>
        )}
        {message.error ? (
          <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12.5px] text-danger">
            {message.error}
          </div>
        ) : (
          <Markdown content={message.content} />
        )}

        {message.citations?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.citations.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-panel-2 px-2 py-0.5 text-[10.5px] text-ink-mute"
              >
                <BookOpen size={10} />
                {c.docName} · P{c.page}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(message.content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1400)
            }}
            className="rounded px-1.5 py-0.5 text-[10.5px] text-ink-mute hover:bg-panel-2 hover:text-ink"
          >
            {copied ? '已复制' : '复制'}
          </button>
          {!isUser && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(message.content)
                setCopied(true)
                setTimeout(() => setCopied(false), 1400)
              }}
              className="rounded px-1.5 py-0.5 text-[10.5px] text-ink-mute hover:bg-panel-2 hover:text-ink"
            >
              引用
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded px-1.5 py-0.5 text-[10.5px] text-ink-mute hover:bg-panel-2 hover:text-danger"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 空状态 ---------------- */
function EmptyChat({ onQuickAsk }: { onQuickAsk: (p: string) => void }) {
  const prompts = [
    '帮我梳理这份材料的核心脉络',
    '用生活化的例子解释最难懂的那一节',
    '给我出 5 道题检验一下理解程度',
    '把这个主题画成一张结构图',
  ]
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary text-white shadow-[var(--shadow)]">
        <Sparkles size={20} />
      </div>
      <h2 className="text-[17px] font-semibold text-ink">你想学点什么？</h2>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-mute">
        上传资料后，选中任意一段文字，我就能就这段内容给你讲解、举例、出题或画图。
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onQuickAsk(p)}
            className="rounded-full border bg-panel-2 px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
          >
            {p}
          </button>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-4 text-[11px] text-ink-mute">
        <span className="flex items-center gap-1">
          <Brain size={12} /> 三层记忆
        </span>
        <span className="flex items-center gap-1">
          <Quote size={12} /> 沉浸式选区
        </span>
        <span className="flex items-center gap-1">
          <Sparkles size={12} /> 可视化动画
        </span>
      </div>
    </div>
  )
}
