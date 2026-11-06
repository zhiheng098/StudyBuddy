/* ============================================================
   StudyBuddy · 文档解析（PDF / Word / Markdown / 文本 / 图片）
   ============================================================ */

import type { DocChunk, DocKind, DocRecord } from '../types'
import { db, uid } from './db'

export interface ParsedChunk {
  page: number
  order: number
  text: string
  heading?: string
}

export interface ParsedDoc {
  name: string
  kind: DocKind
  size: number
  pages: number
  text: string
  preview: string
  chunks: ParsedChunk[]
  blob?: Blob
  imageDataUrl?: string
  /** docx 的渲染 HTML */
  html?: string
}

/* ---------------- PDF ---------------- */
let pdfjsPromise: Promise<any> | null = null

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib: any = await import('pdfjs-dist')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      lib.GlobalWorkerOptions.workerSrc = workerUrl
      return lib
    })()
  }
  return pdfjsPromise
}

export async function parsePdf(file: File | Blob): Promise<ParsedDoc> {
  const pdfjs = await getPdfjs()
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    let out = ''
    let lastY: number | null = null
    for (const item of tc.items as any[]) {
      if (typeof item.str !== 'string') continue
      const y = item.transform ? Math.round(item.transform[5]) : null
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) out += '\n'
      else if (out && !out.endsWith(' ') && !out.endsWith('\n')) out += ' '
      out += item.str
      if (item.hasEOL) out += '\n'
      if (y !== null) lastY = y
    }
    pages.push(out.trim())
  }
  const text = pages.join('\n\n')
  return {
    name: (file as File).name ?? 'document.pdf',
    kind: 'pdf',
    size: file.size,
    pages: doc.numPages,
    text,
    preview: text.slice(0, 600),
    chunks: buildChunks(pages),
    blob: file,
  }
}

/* ---------------- Word ---------------- */
export async function parseDocx(file: File | Blob): Promise<ParsedDoc> {
  const mammoth: any = await import('mammoth')
  const buf = await file.arrayBuffer()
  const [htmlRes, textRes] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer: buf }),
    mammoth.extractRawText({ arrayBuffer: buf }),
  ])
  const text: string = (textRes.value || '').trim()
  const html: string = htmlRes.value || ''
  return {
    name: (file as File).name ?? 'document.docx',
    kind: 'docx',
    size: file.size,
    pages: 1,
    text,
    preview: text.slice(0, 600),
    chunks: buildChunks([text]),
    blob: file,
    html,
  }
}

/* ---------------- Markdown / 文本 ---------------- */
export async function parseText(file: File | Blob): Promise<ParsedDoc> {
  const raw = await file.text()
  const name = (file as File).name ?? 'document.txt'
  const kind: DocKind = /\.mdx?$/i.test(name) ? 'markdown' : 'text'
  return {
    name,
    kind,
    size: file.size,
    pages: 1,
    text: raw,
    preview: raw.slice(0, 600),
    chunks: buildChunks([raw]),
    blob: file,
  }
}

/* ---------------- 图片 ---------------- */
export async function parseImage(file: File | Blob): Promise<ParsedDoc> {
  const dataUrl = await blobToDataUrl(file)
  return {
    name: (file as File).name ?? 'image',
    kind: 'image',
    size: file.size,
    pages: 1,
    text: '',
    preview: '',
    chunks: [],
    blob: file,
    imageDataUrl: dataUrl,
  }
}

/* ---------------- 统一入口 ---------------- */
export async function parseFile(file: File): Promise<ParsedDoc> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf' || file.type === 'application/pdf') return parsePdf(file)
  if (ext === 'docx' || file.type.includes('wordprocessingml')) return parseDocx(file)
  if (ext === 'doc') {
    // 旧版 .doc 无法直接解析，提示用户另存为 .docx
    throw new Error('暂不支持旧版 .doc，请另存为 .docx 后再上传')
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext) || file.type.startsWith('image/')) {
    return parseImage(file)
  }
  if (['md', 'markdown', 'txt', 'json', 'csv', 'ts', 'js', 'py', 'java', 'c', 'cpp', 'go', 'rs'].includes(ext)) {
    return parseText(file)
  }
  // 兜底：按文本处理
  return parseText(file)
}

/* ---------------- 分块 ---------------- */
export function buildChunks(pages: string[], target = 700): ParsedChunk[] {
  const chunks: ParsedChunk[] = []
  let order = 0
  pages.forEach((pageText, idx) => {
    const page = idx + 1
    const paras = pageText
      .split(/\n{2,}/)
      .map((p) => p.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
    let buf = ''
    let heading: string | undefined
    for (const para of paras) {
      if (/^(#{1,4}\s|第[一二三四五六七八九十0-9]+[章节]|[0-9]+(\.[0-9]+)*\s+\S)/.test(para) && para.length < 80) {
        heading = para.replace(/^#+\s*/, '').slice(0, 60)
      }
      if ((buf + para).length > target && buf) {
        chunks.push({ page, order: order++, text: buf, heading })
        buf = ''
      }
      buf += (buf ? '\n' : '') + para
    }
    if (buf.trim()) chunks.push({ page, order: order++, text: buf, heading })
  })
  return chunks
}

/* ---------------- 工具 ---------------- */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

/** 解析结果落库 */
export async function persistDoc(parsed: ParsedDoc, collection?: string): Promise<DocRecord> {
  const id = uid('doc_')
  const rec: DocRecord = {
    id,
    name: parsed.name,
    kind: parsed.kind,
    size: parsed.size,
    pages: parsed.pages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    text: parsed.text,
    preview: parsed.preview,
    imageDataUrl: parsed.imageDataUrl,
    html: parsed.html,
    collection,
  }
  const rows: DocChunk[] = parsed.chunks.map((c) => ({
    id: uid('chk_'),
    docId: id,
    docName: parsed.name,
    page: c.page,
    order: c.order,
    text: c.text,
    heading: c.heading,
  }))
  await db.transaction('rw', [db.docs, db.chunks, db.fileBlobs], async () => {
    await db.docs.add(rec)
    if (rows.length) await db.chunks.bulkAdd(rows)
    if (parsed.blob) await db.fileBlobs.put({ id, blob: parsed.blob })
  })
  return rec
}
