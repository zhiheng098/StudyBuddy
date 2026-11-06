/* ============================================================
   StudyBuddy · 本地检索（BM25 风格，无需 embedding，零成本零延迟）
   ============================================================ */

import type { DocChunk, SearchHit } from '../types'
import { db } from './db'

const STOP = new Set([
  '的', '了', '和', '是', '在', '有', '与', '对', '为', '这', '那', '也', '就', '都', '而', '及',
  '或', '一个', '可以', '进行', '通过', '因为', '所以', '如果', '什么', '怎么', 'the', 'a', 'an',
  'of', 'to', 'and', 'is', 'in', 'for', 'on', 'with', 'that', 'this', 'it', 'as', 'be', 'are',
])

function tokenize(text: string): string[] {
  const out: string[] = []
  const lower = (text || '').toLowerCase()
  // 英文/数字词
  for (const m of lower.matchAll(/[a-z0-9_+#.-]{2,}/g)) out.push(m[0])
  // 中日韩单字 + 双字词
  const cjk = lower.replace(/[^\u4e00-\u9fa5\u3040-\u30ff]/g, ' ')
  for (const seg of cjk.split(/\s+/)) {
    if (!seg) continue
    for (let i = 0; i < seg.length; i++) {
      const uni = seg[i]
      if (!STOP.has(uni)) out.push(uni)
      if (i + 2 <= seg.length) out.push(seg.slice(i, i + 2))
    }
  }
  return out
}

interface Indexed {
  chunk: DocChunk
  tf: Map<string, number>
  len: number
}

let cache: { key: string; index: Indexed[]; df: Map<string, number>; avg: number } | null = null

async function buildIndex(docId?: string): Promise<{ index: Indexed[]; df: Map<string, number>; avg: number }> {
  const key = docId ?? '__all__'
  if (cache && cache.key === key) return cache
  const chunks = docId
    ? await db.chunks.where('docId').equals(docId).toArray()
    : await db.chunks.toArray()
  chunks.sort((a, b) => a.docId.localeCompare(b.docId) || a.order - b.order)

  const index: Indexed[] = []
  const df = new Map<string, number>()
  let total = 0
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text)
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
    total += tokens.length
    index.push({ chunk, tf, len: tokens.length || 1 })
  }
  const avg = index.length ? total / index.length : 1
  cache = { key, index, df, avg }
  return cache
}

export function invalidateIndex() {
  cache = null
}

/**
 * BM25 检索。返回按分数降序的命中片段。
 */
export async function search(
  query: string,
  opts: { docId?: string; limit?: number } = {},
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 6
  const qTokens = [...new Set(tokenize(query))]
  if (!qTokens.length) return []
  const { index, df, avg } = await buildIndex(opts.docId)
  if (!index.length) return []

  const N = index.length
  const k1 = 1.5
  const b = 0.75
  const hits: SearchHit[] = []

  for (const item of index) {
    let score = 0
    for (const t of qTokens) {
      const f = item.tf.get(t)
      if (!f) continue
      const n = df.get(t) ?? 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (item.len / avg))))
    }
    if (score > 0) {
      hits.push({
        chunkId: item.chunk.id,
        docId: item.chunk.docId,
        docName: item.chunk.docName,
        page: item.chunk.page,
        text: item.chunk.text,
        score,
      })
    }
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}

/** 找出包含某段文字的片段（用于选区 → 定位上下文） */
export async function findContaining(
  needle: string,
  docId: string,
): Promise<DocChunk | undefined> {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const n = norm(needle).slice(0, 40)
  if (!n) return undefined
  const chunks = await db.chunks.where('docId').equals(docId).toArray()
  return chunks.find((c) => norm(c.text).includes(n))
}
