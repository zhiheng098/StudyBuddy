import Dexie, { type Table } from 'dexie'
import type {
  Attempt,
  Artifact,
  ChatMessage,
  Conversation,
  Diagnostic,
  DocChunk,
  DocRecord,
  GrowthModule,
  KnowledgeEdge,
  KnowledgeNode,
  MemoryFact,
  MemorySynthesis,
  MemoryTrace,
  Note,
  Paper,
  Question,
} from '../types'

class StudyBuddyDB extends Dexie {
  docs!: Table<DocRecord, string>
  chunks!: Table<DocChunk, string>
  conversations!: Table<Conversation, string>
  messages!: Table<ChatMessage, string>
  knowledge!: Table<KnowledgeNode, string>
  edges!: Table<KnowledgeEdge, string>
  memoryTraces!: Table<MemoryTrace, string>
  memoryFacts!: Table<MemoryFact, string>
  memorySynthesis!: Table<MemorySynthesis, string>
  questions!: Table<Question, string>
  attempts!: Table<Attempt, string>
  modules!: Table<GrowthModule, string>
  diagnostics!: Table<Diagnostic, string>
  notes!: Table<Note, string>
  artifacts!: Table<Artifact, string>
  papers!: Table<Paper, string>
  fileBlobs!: Table<{ id: string; blob: Blob }, string>

  constructor() {
    super('StudyBuddyDB')
    /* v1：初始结构 */
    this.version(1).stores({
      docs: 'id, name, createdAt, kind, collection',
      chunks: 'id, docId, [docId+order]',
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      knowledge: 'id, name, docId, type, updatedAt, mastery',
      edges: 'id, source, target, type',
      memoryTraces: 'id, createdAt, kind',
      memoryFacts: 'id, createdAt, category',
      memorySynthesis: 'id, createdAt',
      questions: 'id, docId, moduleId, createdAt, type',
      attempts: 'id, questionId, createdAt, moduleId, correct',
      modules: 'id, docId, status, nextReviewAt, order',
      diagnostics: 'id, docId, createdAt',
      notes: 'id, docId, updatedAt',
      artifacts: 'id, createdAt',
      papers: 'id, title',
      fileBlobs: 'id',
    })
    /* v2：补齐 docs.updatedAt / conversations.docId 索引 */
    this.version(2).stores({
      docs: 'id, name, createdAt, updatedAt, kind, collection',
      chunks: 'id, docId, [docId+order]',
      conversations: 'id, updatedAt, createdAt, docId',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      knowledge: 'id, name, docId, type, updatedAt, mastery',
      edges: 'id, source, target, type',
      memoryTraces: 'id, createdAt, kind',
      memoryFacts: 'id, createdAt, category',
      memorySynthesis: 'id, createdAt',
      questions: 'id, docId, moduleId, createdAt, type',
      attempts: 'id, questionId, createdAt, moduleId, correct',
      modules: 'id, docId, status, nextReviewAt, order',
      diagnostics: 'id, docId, createdAt',
      notes: 'id, docId, updatedAt',
      artifacts: 'id, createdAt',
      papers: 'id, title',
      fileBlobs: 'id',
    })
  }
}

export const db = new StudyBuddyDB()

/* ---------------- 工具 ---------------- */
export const uid = (prefix = ''): string =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const now = (): number => Date.now()

/* ---------------- 统计 ---------------- */
export async function studyStats() {
  const [docs, questions, attempts, knowledge, modules, conversations] = await Promise.all([
    db.docs.count(),
    db.questions.count(),
    db.attempts.count(),
    db.knowledge.count(),
    db.modules.count(),
    db.conversations.count(),
  ])
  const mastered = await db.modules.where('status').equals('mastered').count()
  const correctAttempts = await db.attempts.filter((a) => a.correct).count()
  return {
    docs,
    questions,
    attempts,
    knowledge,
    modules,
    mastered,
    conversations,
    accuracy: attempts ? Math.round((correctAttempts / attempts) * 100) : 0,
  }
}

/** 今日新增学习量 */
export async function todayActivity() {
  const start = new Date().setHours(0, 0, 0, 0)
  const [messages, attempts, notes] = await Promise.all([
    db.messages.where('createdAt').above(start).count(),
    db.attempts.where('createdAt').above(start).count(),
    db.notes.where('updatedAt').above(start).count(),
  ])
  return { messages, attempts, notes }
}

/* ---------------- 清理 ---------------- */
export async function deleteDocCascade(docId: string) {
  await db.transaction(
    'rw',
    [db.docs, db.chunks, db.knowledge, db.questions, db.modules, db.diagnostics, db.conversations],
    async () => {
      await db.docs.delete(docId)
      await db.chunks.where('docId').equals(docId).delete()
      await db.knowledge.where('docId').equals(docId).delete()
      await db.questions.where('docId').equals(docId).delete()
      await db.modules.where('docId').equals(docId).delete()
      await db.diagnostics.where('docId').equals(docId).delete()
      await db.conversations.where('docId').equals(docId).modify({ docId: undefined })
    },
  )
}

export async function exportAll(): Promise<string> {
  const dump = {
    version: 1,
    exportedAt: now(),
    docs: await db.docs.toArray(),
    conversations: await db.conversations.toArray(),
    messages: await db.messages.toArray(),
    knowledge: await db.knowledge.toArray(),
    edges: await db.edges.toArray(),
    memoryFacts: await db.memoryFacts.toArray(),
    memoryTraces: await db.memoryTraces.toArray(),
    memorySynthesis: await db.memorySynthesis.toArray(),
    questions: await db.questions.toArray(),
    attempts: await db.attempts.toArray(),
    modules: await db.modules.toArray(),
    notes: await db.notes.toArray(),
  }
  return JSON.stringify(dump, null, 2)
}

export async function importAll(json: string): Promise<void> {
  const dump = JSON.parse(json)
  if (!dump || typeof dump !== 'object') throw new Error('文件格式不正确')
  await db.transaction(
    'rw',
    [
      db.docs,
      db.chunks,
      db.conversations,
      db.messages,
      db.knowledge,
      db.edges,
      db.memoryFacts,
      db.memoryTraces,
      db.memorySynthesis,
      db.questions,
      db.attempts,
      db.modules,
      db.notes,
    ],
    async () => {
      if (dump.docs) await db.docs.bulkPut(dump.docs)
      if (dump.conversations) await db.conversations.bulkPut(dump.conversations)
      if (dump.messages) await db.messages.bulkPut(dump.messages)
      if (dump.knowledge) await db.knowledge.bulkPut(dump.knowledge)
      if (dump.edges) await db.edges.bulkPut(dump.edges)
      if (dump.memoryFacts) await db.memoryFacts.bulkPut(dump.memoryFacts)
      if (dump.memoryTraces) await db.memoryTraces.bulkPut(dump.memoryTraces)
      if (dump.memorySynthesis) await db.memorySynthesis.bulkPut(dump.memorySynthesis)
      if (dump.questions) await db.questions.bulkPut(dump.questions)
      if (dump.attempts) await db.attempts.bulkPut(dump.attempts)
      if (dump.modules) await db.modules.bulkPut(dump.modules)
      if (dump.notes) await db.notes.bulkPut(dump.notes)
    },
  )
}

export async function clearAll(): Promise<void> {
  await db.delete()
  await db.open()
}
