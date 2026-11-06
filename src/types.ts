/* ============================================================
   StudyBuddy · 全局类型定义
   ============================================================ */

export type ThemeName = 'classic' | 'tech' | 'fresh' | 'pika'

export type LLMChannel = 'workbuddy' | 'own' | 'demo'

export type StudyMode = 'chat' | 'explain' | 'solve' | 'quiz' | 'research' | 'visualize'

export type DocKind = 'pdf' | 'docx' | 'markdown' | 'text' | 'image' | 'unknown'

/* ---------------- 文档 ---------------- */
export interface DocRecord {
  id: string
  name: string
  kind: DocKind
  size: number
  pages: number
  createdAt: number
  updatedAt: number
  /** 全文纯文本（用于检索与 RAG） */
  text: string
  /** 精简预览 */
  preview: string
  /** 图片型文档存 base64（仅视觉模型用） */
  imageDataUrl?: string
  /** docx 渲染后的 HTML */
  html?: string
  /** 已被拆解的知识点数量 */
  knowledgeCount?: number
  /** 所属知识库（可空） */
  collection?: string
  color?: string
}

export interface DocChunk {
  id: string
  docId: string
  docName: string
  page: number
  order: number
  text: string
  /** 章节标题（从 PDF 大纲或标题推断） */
  heading?: string
}

/* ---------------- 会话与消息 ---------------- */
export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  mode: StudyMode
  docId?: string
  /** 工作台侧栏显示的会话分组 */
  pinned?: boolean
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  /** 引用来源 */
  citations?: Citation[]
  /** 关联的选中片段 */
  selection?: SelectionContext
  /** 附加的可视化块 */
  artifacts?: Artifact[]
  /** 模型思维链（折叠展示） */
  reasoning?: string
  /** 模型思维链（折叠展示） */
  mode?: StudyMode
  streaming?: boolean
  error?: string
}

export interface Citation {
  docId: string
  docName: string
  page: number
  snippet: string
}

export interface SelectionContext {
  docId: string
  docName: string
  page: number
  text: string
  /** 选区前后文 */
  before?: string
  after?: string
}

/* ---------------- 可视化产物 ---------------- */
export type ArtifactKind =
  | 'mermaid'
  | 'math'
  | 'chart'
  | 'animation'
  | 'code'
  | 'quiz'
  | 'flashcard'
  | 'timeline'

export interface Artifact {
  id: string
  kind: ArtifactKind
  title: string
  /** 内容：mermaid 源码 / LaTeX / JSON 配置 / 代码 */
  content: string
  createdAt: number
}

/* ---------------- 知识图谱 ---------------- */
export type KnowledgeType = 'concept' | 'formula' | 'code' | 'method' | 'entity' | 'example'

export interface KnowledgeNode {
  id: string
  name: string
  type: KnowledgeType
  summary: string
  docId?: string
  docName?: string
  page?: number
  /** 掌握度 0~1 */
  mastery: number
  /** 出现次数 */
  mentions: number
  createdAt: number
  updatedAt: number
  tags: string[]
}

export type EdgeType = 'prerequisite' | 'related' | 'contains' | 'example' | 'contrasts'

export interface KnowledgeEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  weight: number
  note?: string
  createdAt: number
}

/* ---------------- 记忆（三层） ----------------
   L1 原始轨迹 / L2 事实摘要 / L3 跨面综合
*/
export interface MemoryTrace {
  id: string
  kind: 'chat' | 'read' | 'quiz' | 'review' | 'note'
  summary: string
  refId?: string
  createdAt: number
  /** 溯源 */
  evidenceIds: string[]
}

export interface MemoryFact {
  id: string
  text: string
  category: 'preference' | 'level' | 'goal' | 'weakness' | 'achievement' | 'fact'
  confidence: number
  source: string
  evidenceIds: string[]
  createdAt: number
  edited?: boolean
}

export interface MemorySynthesis {
  id: string
  text: string
  title: string
  refFactIds: string[]
  createdAt: number
}

/* ---------------- 题库 ---------------- */
export type QuestionType = 'choice' | 'multi' | 'judge' | 'short' | 'code' | 'proof'

export interface Question {
  id: string
  docId?: string
  docName?: string
  moduleId?: string
  knowledgeId?: string
  type: QuestionType
  stem: string
  options?: string[]
  answer: string
  explanation?: string
  difficulty: 1 | 2 | 3 | 4 | 5
  tags: string[]
  source: 'ai' | 'manual'
  createdAt: number
}

export interface Attempt {
  id: string
  questionId: string
  questionStem?: string
  userAnswer: string
  correct: boolean
  score: number
  feedback?: string
  moduleId?: string
  knowledgeId?: string
  createdAt: number
}

/* ---------------- 星空成长 ---------------- */
export interface GrowthModule {
  id: string
  docId: string
  docName: string
  title: string
  /** 模块内知识大纲 */
  outline: string
  /** 该模块包含的知识点 id */
  knowledgeIds: string[]
  order: number
  /** 未开始 / 消化中 / 已检验 / 已掌握 */
  status: 'todo' | 'digesting' | 'checked' | 'mastered'
  mastery: number
  digestNotes?: string
  lastReviewAt?: number
  nextReviewAt?: number
  reviewStage: number
  createdAt: number
}

export interface Diagnostic {
  id: string
  docId: string
  docName: string
  questions: DiagnosticQuestion[]
  answers: Record<string, string>
  score: number
  createdAt: number
  /** 诊断后生成的模块 id */
  moduleIds: string[]
}

export interface DiagnosticQuestion {
  id: string
  stem: string
  options?: string[]
  answer: string
  difficulty: 1 | 2 | 3
  moduleHint?: string
}

export interface Note {
  id: string
  docId?: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

/* ---------------- 设置 ---------------- */
export interface LLMConfig {
  channel: LLMChannel
  /** 自带 Key 通道 */
  baseURL: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  /** WorkBuddy 免密通道可用模型 */
  wbModel?: string
  /** 演示模式 */
  demoMode?: boolean
}

export interface AppSettings {
  theme: ThemeName
  llm: LLMConfig
  leftWidth: number
  rightWidth: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  /** 选区提问自动附带上下文 */
  autoContext: boolean
  /** 学习目标 / 个人偏好 */
  persona: string
  userName: string
  /** 今日学习统计 */
  streak: number
  lastActiveDate?: string
}

/* ---------------- 文献 ---------------- */
export interface Paper {
  id: string
  title: string
  authors: string
  year: string
  venue?: string
  abstract?: string
  url?: string
  doi?: string
  source: 'semantic-scholar' | 'openalex' | 'arxiv'
  citations?: number
}

/* ---------------- 检索命中 ---------------- */
export interface SearchHit {
  chunkId: string
  docId: string
  docName: string
  page: number
  text: string
  score: number
}
