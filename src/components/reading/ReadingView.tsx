import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  BarChart3,
  FileQuestion,
  Layers,
  Lightbulb,
  Network,
  Quote,
  Sparkles,
  X,
} from 'lucide-react'
import { db } from '../../lib/db'
import { useApp } from '../../store/app'
import type { DocRecord, SelectionContext } from '../../types'
import { ChatPanel } from '../chat/ChatPanel'
import { PdfReader, type SelectionPayload } from './PdfReader'
import { DocViewer } from './DocViewer'
import { extractKnowledge } from '../../lib/actions'

interface Props {
  docId?: string | null
  onDocChange?: (id: string) => void
}

export function ReadingView({ onDocChange }: Props) {
  const { settings, activeDocId, setActiveDocId, setConversationId, conversationId, notify } = useApp()
  const [docs, setDocs] = useState<DocRecord[]>([])
  const [blob, setBlob] = useState<Blob | null>(null)
  const [html, setHtml] = useState<string | undefined>()
  const [selection, setSelection] = useState<SelectionContext | null>(null)
  const [toolbar, setToolbar] = useState<SelectionPayload | null>(null)
  const [docRatio, setDocRatio] = useState(56)
  const [currentPage, setCurrentPage] = useState(1)
  const splitRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  /* ---- 载入文档列表 ---- */
  useEffect(() => {
    const load = async () => {
      const list = await db.docs.orderBy('updatedAt').reverse().toArray()
      setDocs(list)
      if (!activeDocId && list.length) setActiveDocId(list[0].id)
    }
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [activeDocId, setActiveDocId])

  const doc = useMemo(() => docs.find((d) => d.id === activeDocId), [docs, activeDocId])

  /* ---- 载入二进制 ---- */
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!doc) {
        setBlob(null)
        return
      }
      const rec = await db.fileBlobs.get(doc.id)
      if (!alive) return
      setBlob(rec?.blob ?? null)
      setHtml(doc.html)
      setCurrentPage(1)
    }
    load()
    return () => {
      alive = false
    }
  }, [doc])

  /* ---- 选区 ---- */
  const handleSelect = useCallback(
    (payload: SelectionPayload) => {
      if (!doc) return
      setToolbar(payload)
      setSelection({
        docId: doc.id,
        docName: doc.name,
        page: payload.page,
        text: payload.text,
      })
    },
    [doc],
  )

  const clearSelection = () => {
    setToolbar(null)
    setSelection(null)
  }

  /* ---- 内部左右分栏拖拽 ---- */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !splitRef.current) return
      const rect = splitRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setDocRatio(Math.max(28, Math.min(78, pct)))
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const ACTIONS = [
    { key: 'explain', label: '解释这段', icon: Sparkles, prompt: '请深入解释这段内容：这句话到底在说什么、为什么这么说、用什么原理支撑。' },
    { key: 'example', label: '举个例子', icon: Lightbulb, prompt: '请用一个具体的例子（最好带数值或代码）来解释这段内容。' },
    { key: 'visual', label: '可视化', icon: BarChart3, prompt: '请把这段内容的结构或过程可视化，画一张图或给出动画脚本。' },
    { key: 'quiz', label: '出题', icon: FileQuestion, prompt: '请围绕这段内容出 2 道检验题，并给出答案与解析。' },
    { key: 'graph', label: '记入图谱', icon: Network, prompt: '' },
  ]

  const runAction = async (action: (typeof ACTIONS)[number]) => {
    if (!selection) return
    if (action.key === 'graph') {
      notify('正在提炼知识点…')
      if (settings.llm.channel === 'demo' || settings.llm.demoMode) {
        // 演示模式下没有模型可用，直接用选区内容本地建点，保证图谱功能可被体验
        const name =
          selection.text.slice(0, 18).replace(/\s+/g, ' ') + (selection.text.length > 18 ? '…' : '')
        const existing = await db.knowledge.where('name').equals(name).first()
        if (existing) {
          existing.mentions += 1
          existing.updatedAt = Date.now()
          await db.knowledge.put(existing)
          notify('该知识点已在图谱中，已累计出现次数', 'good')
        } else {
          await db.knowledge.add({
            id: `kp_${Date.now().toString(36)}`,
            name,
            type: 'concept',
            summary: selection.text.slice(0, 120),
            docId: selection.docId,
            docName: selection.docName,
            page: selection.page,
            mastery: 0.2,
            mentions: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: ['演示'],
          })
          notify('已记入知识图谱（演示模式）', 'good')
        }
        clearSelection()
        return
      }
      try {
        const { nodes } = await extractKnowledge(settings.llm, {
          docId: selection.docId,
          docName: selection.docName,
          text: selection.text,
          page: selection.page,
        })
        notify(`已沉淀 ${nodes.length} 个知识点到知识图谱`, 'good')
      } catch {
        notify('提炼失败，请检查模型配置', 'bad')
      }
      clearSelection()
      return
    }
    // 把动作转化为追问，交给 ChatPanel
    setToolbar(null)
    window.dispatchEvent(new CustomEvent('sb:ask', { detail: action.prompt }))
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <BookOpen size={22} />
        </div>
        <h2 className="text-[16px] font-semibold text-ink">先上传一份资料</h2>
        <p className="max-w-md text-[12.5px] leading-relaxed text-ink-mute">
          支持 PDF、Word（.docx）、Markdown、纯文本与图片。上传后即可进入沉浸式阅读：选中任意一段文字，AI 助教会就这段内容给你讲解。
        </p>
        <button
          onClick={() => useApp.getState().setView('library')}
          className="mt-1 rounded-lg bg-gradient-to-br from-accent to-primary px-4 py-2 text-[12.5px] font-medium text-white shadow-[var(--shadow-sm)] transition hover:brightness-110"
        >
          去资料库上传
        </button>
      </div>
    )
  }

  return (
    <div ref={splitRef} className="flex h-full min-h-0">
      {/* 文档区 */}
      <div
        className="relative flex min-w-0 flex-col"
        style={{ width: `${docRatio}%`, minWidth: 360 }}
      >
        {/* 文档切换条 */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b bg-[var(--panel-trans)] px-3 py-1.5 backdrop-blur">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setActiveDocId(d.id)
                onDocChange?.(d.id)
                clearSelection()
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition ${
                d.id === activeDocId
                  ? 'bg-primary-soft font-medium text-primary'
                  : 'text-ink-mute hover:bg-panel-2 hover:text-ink'
              }`}
            >
              <BookOpen size={11} />
              <span className="max-w-[140px] truncate">{d.name}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1">
          {doc.kind === 'pdf' && blob ? (
            <PdfReader
              blob={blob}
              docName={doc.name}
              onSelect={handleSelect}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          ) : (
            <DocViewer doc={doc} html={html} onSelect={handleSelect} />
          )}
        </div>
      </div>

      {/* 内部拖拽条 */}
      <div
        className="drag-handle z-20 w-[6px] shrink-0"
        onPointerDown={(e) => {
          e.preventDefault()
          dragging.current = true
          document.body.style.cursor = 'col-resize'
          document.body.style.userSelect = 'none'
        }}
        title="拖动调整文档 / 对话比例"
      />

      {/* 对话区 */}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--bg)]" style={{ minWidth: 300 }}>
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <Layers size={13} className="text-ink-mute" />
          <span className="text-[12px] text-ink-soft">AI 助教</span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-ink-mute">· 与《{doc.name}》联动</span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {selection && (
              <span className="flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-[10.5px] text-primary">
                <Quote size={10} />
                已选中 P{selection.page}
              </span>
            )}
            <button
              onClick={() => {
                const id = `conv_${Date.now().toString(36)}`
                db.conversations
                  .add({ id, title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), mode: 'chat', docId: doc.id })
                  .then(() => setConversationId(id))
              }}
              className="rounded-md border px-2 py-0.5 text-[11px] text-ink-mute transition hover:border-primary/40 hover:text-primary"
            >
              新对话
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel
            conversationId={conversationId}
            onNeedConversation={async () => {
              const id = `conv_${Date.now().toString(36)}`
              await db.conversations.add({
                id,
                title: '新对话',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                mode: 'chat',
                docId: doc.id,
              })
              setConversationId(id)
              return id
            }}
            selection={selection}
            onClearSelection={clearSelection}
            docId={doc.id}
          />
        </div>
      </div>

      {/* 选区浮动工具条 */}
      {toolbar && selection && (
        <div
          className="sel-toolbar"
          style={{
            top: Math.max(8, toolbar.rect.top - 46),
            left: Math.min(
              Math.max(8, toolbar.rect.left + toolbar.rect.width / 2 - 150),
              window.innerWidth - 310,
            ),
          }}
        >
          {ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.key}
                onClick={() => runAction(a)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-soft transition hover:bg-primary-soft hover:text-primary"
              >
                <Icon size={12} />
                {a.label}
              </button>
            )
          })}
          <button
            onClick={clearSelection}
            className="rounded-lg p-1.5 text-ink-mute transition hover:bg-danger/10 hover:text-danger"
            title="取消"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
