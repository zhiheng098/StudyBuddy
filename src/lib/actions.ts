/* ============================================================
   StudyBuddy · 业务动作层
   ============================================================ */

import type {
  Attempt,
  ChatMessage,
  Diagnostic,
  DiagnosticQuestion,
  GrowthModule,
  KnowledgeEdge,
  KnowledgeNode,
  LLMConfig,
  Paper,
  Question,
  QuestionType,
  SelectionContext,
  StudyMode,
} from '../types'
import { db, uid } from './db'
import { callJSON, callLLM, streamLLM, type LLMMessage } from './llm'
import {
  buildContextBlock,
  DIAGNOSTIC_PROMPT,
  DIGEST_PROMPT,
  DOC_OVERVIEW_PROMPT,
  GRADE_PROMPT,
  KNOWLEDGE_EXTRACT_PROMPT,
  MEMORY_SYNTHESIS_PROMPT,
  MODULE_OUTLINE_PROMPT,
  QUIZ_PROMPT,
  systemPrompt,
} from './prompts'
import { search } from './retrieval'
import { scheduleReview } from './srs'

/* ============================================================
   1. 对话：带上下文的流式问答
   ============================================================ */
export interface SendOptions {
  text: string
  conversationId: string
  mode?: StudyMode
  selection?: SelectionContext
  docId?: string
  persona?: string
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onDone?: (full: string) => void
}

export async function sendChatMessage(cfg: LLMConfig, opts: SendOptions): Promise<string> {
  const mode = opts.mode ?? 'chat'
  const userMsg: ChatMessage = {
    id: uid('msg_'),
    conversationId: opts.conversationId,
    role: 'user',
    content: opts.text,
    createdAt: Date.now(),
    selection: opts.selection,
    mode,
  }
  await db.messages.add(userMsg)

  // 上下文检索
  let hits: { docName: string; page: number; text: string }[] = []
  if (opts.selection) {
    const before = await findContext(opts.selection.docId, opts.selection.text, -1)
    const after = await findContext(opts.selection.docId, opts.selection.text, 1)
    opts.selection.before = before
    opts.selection.after = after
  } else if (opts.text.trim().length > 2) {
    const res = await search(opts.text, { docId: opts.docId, limit: 5 })
    hits = res.map((r) => ({ docName: r.docName, page: r.page, text: r.text }))
  }

  const ctx = buildContextBlock({
    docName: opts.selection?.docName,
    page: opts.selection?.page,
    selection: opts.selection?.text,
    before: opts.selection?.before,
    after: opts.selection?.after,
    hits,
    persona: opts.persona,
  })

  // 历史上下文（最近 9 条）
  const allMsgs = await db.messages.where('conversationId').equals(opts.conversationId).toArray()
  const history = allMsgs
    .filter((m) => m.role !== 'system' && m.id !== userMsg.id)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-9)

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt(mode) },
    ...(ctx
      ? [
          {
            role: 'user' as const,
            content: `【上下文资料】\n${ctx}\n\n【用户问题】\n${opts.text}`,
          },
        ]
      : []),
    ...history
      .filter((m) => m.id !== userMsg.id)
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }) as LLMMessage),
  ]
  if (!ctx) messages.push({ role: 'user', content: opts.text })

  const assistantId = uid('msg_')
  const res = await streamLLM(cfg, {
    messages,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    signal: opts.signal,
    conversationId: opts.conversationId,
    onDelta: opts.onDelta,
  })

  const assistantMsg: ChatMessage = {
    id: assistantId,
    conversationId: opts.conversationId,
    role: 'assistant',
    content: res.text,
    reasoning: res.reasoning || undefined,
    createdAt: Date.now(),
    mode,
    citations: hits.length
      ? hits.map((h) => ({
          docId: opts.selection?.docId ?? '',
          docName: h.docName,
          page: h.page,
          snippet: h.text.slice(0, 160),
        }))
      : opts.selection
        ? [
            {
              docId: opts.selection.docId,
              docName: opts.selection.docName,
              page: opts.selection.page,
              snippet: opts.selection.text.slice(0, 160),
            },
          ]
        : undefined,
  }
  await db.messages.put(assistantMsg)

  // 会话标题
  const conv = await db.conversations.get(opts.conversationId)
  if (conv && (conv.title === '新对话' || conv.title === '新会话')) {
    conv.title = opts.text.slice(0, 24) || '新对话'
    conv.updatedAt = Date.now()
    await db.conversations.put(conv)
  } else if (conv) {
    conv.updatedAt = Date.now()
    await db.conversations.put(conv)
  }

  // L1 记忆轨迹
  await db.memoryTraces.add({
    id: uid('tr_'),
    kind: 'chat',
    summary: opts.selection
      ? `围绕《${opts.selection.docName}》第${opts.selection.page}页的选区提问：${opts.text.slice(0, 60)}`
      : `提问：${opts.text.slice(0, 60)}`,
    refId: assistantId,
    createdAt: Date.now(),
    evidenceIds: [userMsg.id, assistantId],
  })

  opts.onDone?.(res.text)
  return res.text
}

/** 找到选区前后相邻的段落 */
async function findContext(docId: string, needle: string, dir: -1 | 1): Promise<string | undefined> {
  const chunks = await db.chunks.where('docId').equals(docId).sortBy('order')
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  const n = norm(needle).slice(0, 30)
  if (!n) return undefined
  const idx = chunks.findIndex((c) => norm(c.text).includes(n))
  if (idx < 0) return undefined
  const target = chunks[idx + dir]
  return target?.text?.slice(0, 500)
}


/* ============================================================
   2. 知识点沉淀（记忆库 / 知识图谱）
   ============================================================ */
export async function extractKnowledge(
  cfg: LLMConfig,
  opts: { docId?: string; docName?: string; text: string; page?: number },
): Promise<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }> {
  const raw = await callJSON(cfg, {
    messages: [
      { role: 'system', content: KNOWLEDGE_EXTRACT_PROMPT },
      {
        role: 'user',
        content: `文档：${opts.docName ?? '未知'}${opts.page ? ` 第${opts.page}页` : ''}\n\n内容：\n${opts.text.slice(0, 6000)}`,
      },
    ],
    temperature: 0.2,
    maxTokens: 2000,
  })

  const list: any[] = raw?.knowledgepoints ?? raw?.knowledge_points ?? []
  const nodes: KnowledgeNode[] = []
  const edges: KnowledgeEdge[] = []
  const now = Date.now()

  for (const kp of list.slice(0, 24)) {
    if (!kp?.name) continue
    const name = String(kp.name).trim().slice(0, 60)
    const existing = await db.knowledge.where('name').equals(name).first()
    let node: KnowledgeNode
    if (existing) {
      existing.mentions += 1
      existing.updatedAt = now
      existing.summary = kp.summary || existing.summary
      existing.mastery = Math.min(1, existing.mastery + 0.05)
      existing.docId = existing.docId ?? opts.docId
      existing.docName = existing.docName ?? opts.docName
      await db.knowledge.put(existing)
      node = existing
    } else {
      node = {
        id: uid('kp_'),
        name,
        type: (kp.type as KnowledgeNode['type']) ?? 'concept',
        summary: kp.summary ?? '',
        docId: opts.docId,
        docName: opts.docName,
        page: opts.page,
        mastery: 0.1,
        mentions: 1,
        createdAt: now,
        updatedAt: now,
        tags: Array.isArray(kp.tags) ? kp.tags.slice(0, 6).map(String) : [],
      }
      await db.knowledge.add(node)
    }
    nodes.push(node)
  }

  // 关系
  const byName = new Map(nodes.map((n) => [n.name, n]))
  for (const kp of list) {
    const source = byName.get(String(kp?.name ?? '').trim())
    if (!source) continue
    for (const rel of kp?.relations ?? []) {
      const target = byName.get(String(rel?.other ?? '').trim())
      if (!target || target.id === source.id) continue
      const id = `${source.id}->${target.id}`
      const exist = await db.edges.get(id)
      if (!exist) {
        const edge: KnowledgeEdge = {
          id,
          source: source.id,
          target: target.id,
          type: (rel.relation as KnowledgeEdge['type']) ?? 'related',
          weight: 1,
          createdAt: now,
        }
        await db.edges.add(edge)
        edges.push(edge)
      }
    }
  }

  // 记忆事实
  for (const n of nodes.slice(0, 8)) {
    await db.memoryFacts.add({
      id: uid('mf_'),
      text: `${n.name}：${n.summary}`,
      category: 'fact',
      confidence: 0.6,
      source: opts.docName ?? '文档',
      evidenceIds: [n.id],
      createdAt: Date.now(),
    })
  }

  return { nodes, edges }
}

/* ============================================================
   3. 出题 / 批改
   ============================================================ */
export async function generateQuestions(
  cfg: LLMConfig,
  opts: {
    source: string
    docId?: string
    docName?: string
    moduleId?: string
    knowledgeIds?: string[]
    count?: number
    types?: QuestionType[]
  },
): Promise<Question[]> {
  const count = opts.count ?? 5
  const typeHint = opts.types?.length ? `题型限定为：${opts.types.join('、')}。` : ''
  const raw = await callJSON(cfg, {
    messages: [
      { role: 'system', content: QUIZ_PROMPT },
      {
        role: 'user',
        content: `请出 ${count} 道题。${typeHint}\n\n学习内容：\n${opts.source.slice(0, 8000)}`,
      },
    ],
    temperature: 0.6,
    maxTokens: 3000,
  })
  const list: any[] = raw?.questions ?? []
  const now = Date.now()
  const out: Question[] = []
  for (const q of list.slice(0, count)) {
    if (!q?.stem) continue
    const qType = (q.type as QuestionType) ?? 'choice'
    const question: Question = {
      id: uid('q_'),
      docId: opts.docId,
      docName: opts.docName,
      moduleId: opts.moduleId,
      type: qType,
      stem: q.stem,
      options: Array.isArray(q.options) ? q.options.map(String) : undefined,
      answer: String(q.answer ?? ''),
      explanation: q.explanation ? String(q.explanation) : undefined,
      difficulty: ([1, 2, 3, 4, 5].includes(q.difficulty) ? q.difficulty : 3) as Question['difficulty'],
      tags: Array.isArray(q.tags) ? q.tags.slice(0, 5).map(String) : [],
      source: 'ai',
      createdAt: now,
    }
    out.push(question)
  }
  if (out.length) await db.questions.bulkAdd(out)
  return out
}

export interface GradeResult {
  score: number
  correct: boolean
  feedback: string
  keyPoints?: string[]
}

export async function gradeAnswer(
  cfg: LLMConfig,
  opts: { question: Question; userAnswer: string },
): Promise<GradeResult> {
  const raw = await callJSON<any>(cfg, {
    messages: [
      { role: 'system', content: GRADE_PROMPT },
      {
        role: 'user',
        content: `题目：${opts.question.stem}\n${
          opts.question.options ? `选项：${opts.question.options.join(' / ')}\n` : ''
        }参考答案：${opts.question.answer}\n${
          opts.question.explanation ? `解析：${opts.question.explanation}\n` : ''
        }学习者作答：${opts.userAnswer}`,
      },
    ],
    temperature: 0.2,
    maxTokens: 1200,
  })
  const score = Math.max(0, Math.min(100, Number(raw?.score ?? 0)))
  return {
    score,
    correct: raw?.correct === true || score >= 60,
    feedback: String(raw?.feedback ?? ''),
    keyPoints: Array.isArray(raw?.keyPoints) ? raw.keyPoints.map(String) : undefined,
  }
}

export async function recordAttempt(
  question: Question,
  userAnswer: string,
  result: GradeResult,
): Promise<Attempt> {
  const attempt: Attempt = {
    id: uid('at_'),
    questionId: question.id,
    questionStem: question.stem,
    userAnswer,
    correct: result.correct,
    score: result.score,
    feedback: result.feedback,
    moduleId: question.moduleId,
    knowledgeId: question.knowledgeId,
    createdAt: Date.now(),
  }
  await db.attempts.add(attempt)
  return attempt
}

/* ============================================================
   4. 星空成长：诊断 → 分模块 → 消化 → 检验 → 复习
   ============================================================ */
export async function generateDiagnostic(
  cfg: LLMConfig,
  opts: { docId: string; docName: string; content: string },
): Promise<Diagnostic> {
  const raw = await callJSON(cfg, {
    messages: [
      { role: 'system', content: DIAGNOSTIC_PROMPT },
      {
        role: 'user',
        content: `文档《${opts.docName}》\n\n内容：\n${opts.content.slice(0, 10000)}`,
      },
    ],
    temperature: 0.5,
    maxTokens: 3000,
  })
  const list: any[] = raw?.questions ?? []
  const questions: DiagnosticQuestion[] = list.slice(0, 10).map((q) => ({
    id: uid('dq_'),
    stem: String(q?.stem ?? ''),
    options: Array.isArray(q?.options) ? q.options.map(String) : undefined,
    answer: String(q?.answer ?? ''),
    difficulty: ([1, 2, 3].includes(q?.difficulty) ? q.difficulty : 2) as 1 | 2 | 3,
    moduleHint: q?.moduleHint ? String(q.moduleHint) : undefined,
  }))
  const diag: Diagnostic = {
    id: uid('dg_'),
    docId: opts.docId,
    docName: opts.docName,
    questions,
    answers: {},
    score: 0,
    createdAt: Date.now(),
    moduleIds: [],
  }
  await db.diagnostics.add(diag)
  return diag
}

/** 依据诊断答案给模块划分打基础：把题目正确率映射到 moduleHint */
export function scoreDiagnostic(diag: Diagnostic): {
  perModule: Record<string, { correct: number; total: number }>
  overall: number
} {
  const perModule: Record<string, { correct: number; total: number }> = {}
  let correct = 0
  for (const q of diag.questions) {
    const key = q.moduleHint || '综合'
    perModule[key] ??= { correct: 0, total: 0 }
    perModule[key].total += 1
    const ans = diag.answers[q.id] ?? ''
    if (ans && ans.trim() === q.answer.trim()) {
      correct += 1
      perModule[key].correct += 1
    }
  }
  const overall = diag.questions.length
    ? Math.round((correct / diag.questions.length) * 100)
    : 0
  return { perModule, overall }
}

export async function generateModules(
  cfg: LLMConfig,
  opts: { docId: string; docName: string; content: string },
): Promise<GrowthModule[]> {
  const raw = await callJSON(cfg, {
    messages: [
      { role: 'system', content: MODULE_OUTLINE_PROMPT },
      {
        role: 'user',
        content: `文档《${opts.docName}》\n\n内容：\n${opts.content.slice(0, 10000)}`,
      },
    ],
    temperature: 0.4,
    maxTokens: 2500,
  })
  const list: any[] = raw?.modules ?? []
  const now = Date.now()
  const modules: GrowthModule[] = list.slice(0, 8).map((m, i) => ({
    id: uid('mod_'),
    docId: opts.docId,
    docName: opts.docName,
    title: String(m?.title ?? `模块 ${i + 1}`),
    outline: Array.isArray(m?.outline) ? m.outline.map(String).join('\n') : String(m?.outline ?? ''),
    knowledgeIds: [],
    order: i,
    status: 'todo',
    mastery: 0,
    reviewStage: 0,
    createdAt: now,
  }))
  if (modules.length) await db.modules.bulkAdd(modules)
  return modules
}

export async function digestModule(
  cfg: LLMConfig,
  opts: { module: GrowthModule; content: string },
): Promise<string> {
  const text = await callLLM(cfg, {
    messages: [
      { role: 'system', content: systemPrompt('explain') },
      { role: 'user', content: `${DIGEST_PROMPT}\n\n模块：${opts.module.title}\n大纲：\n${opts.module.outline}\n\n原始材料：\n${opts.content.slice(0, 7000)}` },
    ],
    temperature: 0.6,
    maxTokens: 3000,
  })
  const mod = await db.modules.get(opts.module.id)
  if (mod) {
    mod.digestNotes = text
    mod.status = 'digesting'
    mod.mastery = Math.max(mod.mastery, 0.35)
    await db.modules.put(mod)
  }
  return text
}

/** 检验一个模块：出题 → 作答 → 批改 → 更新掌握度与复习排期 */
export async function checkModule(
  cfg: LLMConfig,
  opts: { module: GrowthModule; content: string; answers: Record<string, string> },
): Promise<{ score: number; questions: Question[]; attempts: Attempt[] }> {
  const questions = await generateQuestions(cfg, {
    source: `${opts.module.title}\n${opts.module.outline}\n\n${opts.content.slice(0, 6000)}`,
    docId: opts.module.docId,
    docName: opts.module.docName,
    moduleId: opts.module.id,
    count: 4,
  })
  const attempts: Attempt[] = []
  let total = 0
  for (const q of questions) {
    const userAnswer = opts.answers[q.id] ?? ''
    let result: GradeResult
    if (q.type === 'choice' || q.type === 'judge' || q.type === 'multi') {
      const ok = userAnswer.trim() === q.answer.trim()
      result = {
        score: ok ? 100 : 0,
        correct: ok,
        feedback: ok ? '回答正确。' : `正确答案：${q.answer}。${q.explanation ?? ''}`,
      }
    } else {
      result = await gradeAnswer(cfg, { question: q, userAnswer })
    }
    const at = await recordAttempt(q, userAnswer, result)
    attempts.push(at)
    total += result.score
  }
  const score = questions.length ? Math.round(total / questions.length) : 0
  const mod = await db.modules.get(opts.module.id)
  if (mod) {
    const srs = scheduleReview(score, mod.reviewStage)
    mod.mastery = Math.max(0.15, Math.min(1, score / 100))
    mod.status = score >= 75 ? 'mastered' : score >= 45 ? 'checked' : 'digesting'
    mod.lastReviewAt = Date.now()
    mod.nextReviewAt = srs.nextReviewAt
    mod.reviewStage = srs.stage
    await db.modules.put(mod)
  }
  return { score, questions, attempts }
}

/** 复习一个已掌握模块（间隔重复场景） */
export async function reviewModule(
  cfg: LLMConfig,
  opts: { module: GrowthModule; content: string; answers: Record<string, string> },
): Promise<{ score: number; questions: Question[] }> {
  const result = await checkModule(cfg, opts)
  return { score: result.score, questions: result.questions }
}

/* ============================================================
   5. 记忆综合
   ============================================================ */
export async function synthesizeMemory(cfg: LLMConfig): Promise<number> {
  const facts = await db.memoryFacts.orderBy('createdAt').reverse().limit(40).toArray()
  const traces = await db.memoryTraces.orderBy('createdAt').reverse().limit(30).toArray()
  if (!facts.length && !traces.length) return 0
  const raw = await callJSON(cfg, {
    messages: [
      { role: 'system', content: MEMORY_SYNTHESIS_PROMPT },
      {
        role: 'user',
        content: `【学习事实】\n${facts
          .slice(0, 30)
          .map((f) => `- [${f.id}] (${f.category}) ${f.text}`)
          .join('\n')}\n\n【学习轨迹】\n${traces
          .slice(0, 20)
          .map((t) => `- ${t.summary}`)
          .join('\n')}`,
      },
    ],
    temperature: 0.4,
    maxTokens: 2000,
  })
  const list: any[] = raw?.synthesis ?? []
  let n = 0
  for (const s of list.slice(0, 4)) {
    if (!s?.text) continue
    await db.memorySynthesis.add({
      id: uid('ms_'),
      title: String(s.title ?? '综合认知'),
      text: String(s.text),
      refFactIds: Array.isArray(s.refFactIds) ? s.refFactIds.map(String) : [],
      createdAt: Date.now(),
    })
    n++
  }
  return n
}

/* ============================================================
   6. 文档概览
   ============================================================ */
export async function summarizeDoc(
  cfg: LLMConfig,
  opts: { docName: string; content: string },
): Promise<any> {
  return callJSON(cfg, {
    messages: [
      { role: 'system', content: DOC_OVERVIEW_PROMPT },
      { role: 'user', content: `材料《${opts.docName}》\n\n${opts.content.slice(0, 10000)}` },
    ],
    temperature: 0.4,
    maxTokens: 2000,
  })
}

/* ============================================================
   7. 论文入库
   ============================================================ */
export async function savePapers(papers: Paper[]) {
  if (!papers.length) return
  await db.papers.bulkPut(papers)
}
