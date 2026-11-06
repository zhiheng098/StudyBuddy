import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { db, deleteDocCascade } from '../lib/db'
import { parseFile, persistDoc } from '../lib/parse'
import { invalidateIndex } from '../lib/retrieval'
import { useApp } from '../store/app'
import type { DocRecord } from '../types'

export function LibraryView() {
  const { setActiveDocId, setView, notify } = useApp()
  const [docs, setDocs] = useState<DocRecord[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const list = await db.docs.orderBy('updatedAt').reverse().toArray()
    setDocs(list)
  }
  useEffect(() => {
    load()
  }, [])

  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setBusy(file.name)
      try {
        const parsed = await parseFile(file)
        await persistDoc(parsed)
        invalidateIndex()
        notify(`《${file.name}》已上传并建立索引`, 'good')
      } catch (e: any) {
        notify(`${file.name}：${e?.message ?? '解析失败'}`, 'bad')
      } finally {
        setBusy('')
      }
    }
    load()
  }

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-4xl px-6 py-7">
        <header>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">资料库</h1>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            上传资料后，AI 会建立页级索引；你在阅读器里选中的每一段都能直接提问并带页码溯源。
          </p>
        </header>

        {/* 上传区 */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            if (e.dataTransfer.files?.length) upload(e.dataTransfer.files)
          }}
          onClick={() => fileRef.current?.click()}
          className={`mt-5 cursor-pointer rounded-2xl border-2 border-dashed p-9 text-center transition ${
            drag ? 'border-primary bg-primary-soft/50' : 'border-[var(--border)] hover:border-primary/50 hover:bg-panel-2/40'
          }`}
        >
          {busy ? (
            <>
              <Loader2 size={26} className="mx-auto mb-2 animate-spin text-primary" />
              <p className="text-[13px] text-ink-soft">正在解析 {busy}…</p>
            </>
          ) : (
            <>
              <Upload size={26} className="mx-auto mb-2 text-primary" />
              <p className="text-[13.5px] font-medium text-ink">点击上传，或把文件拖到这里</p>
              <p className="mt-1 text-[11.5px] text-ink-mute">
                支持 PDF · DOCX · Markdown · TXT · 代码文件 · PNG/JPG（最大 50MB）
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp,.csv,.json,.py,.ts,.js,.tsx,.java,.go,.rs"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* 搜索 */}
        {docs.length > 0 && (
          <div className="relative mt-6">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索资料名称…"
              className="w-full rounded-xl border bg-[var(--panel)] py-2 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-primary/50"
            />
          </div>
        )}

        {/* 列表 */}
        <div className="mt-4 space-y-2.5">
          {filtered.map((d) => (
            <div key={d.id} className="card group flex items-center gap-3 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-2 text-ink-mute">
                {d.kind === 'image' ? <ImageIcon size={17} /> : d.kind === 'pdf' ? <FileText size={17} /> : <BookOpen size={17} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{d.name}</p>
                <p className="mt-0.5 text-[11px] text-ink-mute">
                  {d.kind.toUpperCase()} · {(d.size / 1024).toFixed(0)} KB · {d.pages} 页 ·{' '}
                  {new Date(d.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
                {d.preview && (
                  <p className="mt-1 line-clamp-1 text-[11.5px] text-ink-mute">{d.preview}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => {
                    setActiveDocId(d.id)
                    setView('reading')
                  }}
                  className="rounded-lg border px-2.5 py-1.5 text-[11.5px] text-ink-soft transition hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                >
                  阅读
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`确定删除《${d.name}》？相关知识点与题目也会一并移除。`)) return
                    await deleteDocCascade(d.id)
                    invalidateIndex()
                    notify('已删除', 'good')
                    load()
                  }}
                  className="rounded-lg p-1.5 text-ink-mute opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {docs.length === 0 && (
            <div className="py-14 text-center">
              <Sparkles size={22} className="mx-auto mb-2 text-ink-mute" />
              <p className="text-[12.5px] text-ink-mute">资料库还是空的，先上传一份吧</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
