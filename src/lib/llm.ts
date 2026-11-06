/* ============================================================
   StudyBuddy · 多通道大模型网关
   通道：workbuddy(免密/积分) | own(自带Key) | shared(公共兜底) | demo(演示)
   ============================================================ */

import type { LLMConfig } from '../types'
import { WB } from '../config/site'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | LLMContentPart[]
}

export interface LLMContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface LLMCallOptions {
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  /** 工作台会话 ID（用于 WorkBuddy 通道的路由与计量） */
  conversationId?: string
}

export interface LLMResult {
  text: string
  /** 模型的思维链（部分模型会输出），用于折叠展示 */
  reasoning?: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  model?: string
  channel: string
}

export class LLMError extends Error {
  code: string
  requestId?: string
  constructor(message: string, code = 'unknown', requestId?: string) {
    super(message)
    this.name = 'LLMError'
    this.code = code
    this.requestId = requestId
  }
}

/* ------------------------------------------------------------
   WorkBuddy 公共配置
   部署时由发布流程注入：public/wb-public-config.json
------------------------------------------------------------ */
export interface WBPublicConfig {
  endpoint: string
  publishableKey: string
  oauthRelayBaseUrl?: string
}

let wbConfigCache: WBPublicConfig | null = null
let wbClient: any = null

export async function loadWBConfig(): Promise<WBPublicConfig | null> {
  if (wbConfigCache) return wbConfigCache
  // 1) 打包期内置配置（发布版走这条，最稳）
  if (WB.endpoint && WB.publishableKey) {
    wbConfigCache = {
      endpoint: WB.endpoint,
      publishableKey: WB.publishableKey,
      oauthRelayBaseUrl: WB.oauthRelayBaseUrl,
    }
    return wbConfigCache
  }
  // 1) 打包期内置配置（发布版走这条，最稳）
  if (WB.endpoint && WB.publishableKey) {
    wbConfigCache = {
      endpoint: WB.endpoint,
      publishableKey: WB.publishableKey,
      oauthRelayBaseUrl: WB.oauthRelayBaseUrl,
    }
    return wbConfigCache
  }
  const injected = (window as any).__WB_PUBLIC_CONFIG__
  if (injected?.endpoint && injected?.publishableKey) {
    wbConfigCache = injected
    return wbConfigCache
  }
  try {
    const res = await fetch('./wb-public-config.json', { cache: 'no-store' })
    if (res.ok) {
      const cfg = await res.json()
      if (cfg?.endpoint && cfg?.publishableKey) {
        wbConfigCache = cfg
        return wbConfigCache
      }
    }
  } catch {
    /* 无配置属正常情况 */
  }
  return null
}

export async function getWBClient(): Promise<any> {
  if (wbClient) return wbClient
  const cfg = await loadWBConfig()
  if (!cfg) throw new LLMError('当前作品未启用 WorkBuddy 免密通道', 'wb_not_configured')
  const mod: any = await import('@tencent-ai/workbuddy-cloud-sdk')
  wbClient = mod.createWorkBuddyCloud({
    endpoint: cfg.endpoint,
    publishableKey: cfg.publishableKey,
    oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
  })
  return wbClient
}

export async function listWBModels(
  timeoutMs = 8000,
): Promise<
  { id: string; name?: string; disabled?: boolean; supportsImages?: boolean; description?: string }[]
> {
  try {
    const cloud = await getWBClient()
    // 加超时：跨域 / 网络受限时请求可能一直挂着，界面不能因此空着
    const list = await Promise.race([
      cloud.llm.models.list(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('模型列表请求超时')), timeoutMs),
      ),
    ])
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.warn('[StudyBuddy] 获取 WorkBuddy 模型列表失败', e)
    return []
  }
}

/* ------------------------------------------------------------
   OpenAI 兼容通道（自带 Key / 公共兜底）
------------------------------------------------------------ */
function normalizeBase(base: string): string {
  let b = (base || '').trim().replace(/\/+$/, '')
  if (!b) return b
  if (!/\/v\d+/.test(b) && !/\/chat\/completions$/.test(b)) b = `${b}/v1`
  if (/\/chat\/completions$/.test(b)) b = b.replace(/\/chat\/completions$/, '')
  return b
}

interface OpenAIChunk {
  choices?: { delta?: { content?: string | null; reasoning_content?: string | null }; finish_reason?: string | null }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

async function openAIStream(
  cfg: { baseURL: string; apiKey: string; model: string },
  opts: LLMCallOptions,
  onDelta: (d: string) => void,
): Promise<LLMResult> {
  const url = `${normalizeBase(cfg.baseURL)}/chat/completions`
  let text = ''
  let usage: LLMResult['usage']
  let model = cfg.model

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: opts.messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    let code = `http_${res.status}`
    let message = `模型请求失败（${res.status}）`
    try {
      const j = JSON.parse(detail)
      code = j?.error?.code ?? j?.error?.type ?? code
      message = j?.error?.message ?? message
    } catch {
      if (detail) message = detail.slice(0, 300)
    }
    throw new LLMError(message, code)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new LLMError('响应流不可用', 'no_stream')
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let chunk: OpenAIChunk
      try {
        chunk = JSON.parse(payload)
      } catch {
        continue
      }
      const delta = chunk.choices?.[0]?.delta
      if (delta?.content) {
        text += delta.content
        onDelta(delta.content)
      }
      if (chunk.usage) usage = chunk.usage
    }
  }
  return { text, usage, model, channel: 'openai-compatible' }
}

/* ------------------------------------------------------------
   统一入口
------------------------------------------------------------ */
/** 是否已登录 WorkBuddy 账号（决定模型调用记在谁头上） */
export async function isWBSignedIn(): Promise<boolean> {
  try {
    const cloud = await getWBClient()
    const res = await cloud.auth.getSession()
    const s: any = res?.data
    return !!(s && (s.accessToken || s.user))
  } catch {
    return false
  }
}

export interface ChannelStatus {
  channel: string
  available: boolean
  label: string
  hint: string
}

export async function checkChannels(
  cfg: LLMConfig,
  auth?: { signedIn: boolean; name?: string },
): Promise<ChannelStatus[]> {
  const signedIn = !!auth?.signedIn
  const signedName = auth?.name ?? ''
  const wbModels = await listWBModels()
  const wbOk = wbModels.length > 0
  const ownOk = !!(cfg.apiKey && cfg.baseURL && cfg.model)
  return [
    {
      channel: 'workbuddy',
      available: wbOk && signedIn,
      label: 'WorkBuddy 账号通道',
      hint: !wbOk
        ? '当前部署未启用云服务通道'
        : signedIn
          ? `已登录 ${signedName} · ${wbModels.length} 个模型可用，调用计入你自己的 WorkBuddy 积分`
          : '需先点击「使用 WorkBuddy 登录」—— 登录后调用才会计入你自己的积分，未登录不消耗任何人积分',
    },
    {
      channel: 'own',
      available: ownOk,
      label: '我自己的 API Key',
      hint: ownOk
        ? `${cfg.model} @ ${cfg.baseURL} · 费用由你的模型服务商结算`
        : '填写 Base URL / API Key / 模型名后启用',
    },
    {
      channel: 'demo',
      available: true,
      label: '演示模式',
      hint: '内置离线样例响应，可完整体验界面与流程，不调用任何模型',
    },
  ]
}

export interface StreamOptions extends LLMCallOptions {
  onDelta: (delta: string) => void
}

export async function streamLLM(cfg: LLMConfig, opts: StreamOptions): Promise<LLMResult> {
  const { onDelta, ...rest } = opts

  if (cfg.channel === 'demo' || cfg.demoMode) {
    return demoStream(rest, onDelta)
  }

  if (cfg.channel === 'workbuddy') {
    // 只有登录了 WorkBuddy 账号才允许走这条通道：
    // 未登录时请求没有身份，计费会落到作品创建者头上 —— 那等于让访客消耗我的积分。
    const signed = await isWBSignedIn()
    if (!signed) {
      throw new LLMError(
        'WorkBuddy 通道需要先登录账号。请点击右上角「使用 WorkBuddy 登录」，登录后调用会计入你自己的积分；也可以改用「我自己的 API Key」或「演示模式」。',
        'wb_login_required',
      )
    }
    const cloud = await getWBClient()
    const models = await cloud.llm.models.list()
    const enabled = models.filter((m: any) => m.disabled !== true)
    // 优先选轻快且支持多模态的模型，保证流式体验；用户指定优先
    const preferred = ['glm-5.3-flash', 'minimax-m3.1-flash', 'deepseek-v4.1-flash', 'space-bunny']
    const model =
      (cfg.wbModel && enabled.find((m: any) => m.id === cfg.wbModel)) ||
      preferred.map((id) => enabled.find((m: any) => m.id === id)).find(Boolean) ||
      enabled.find((m: any) => m.id === 'auto') ||
      enabled[0]
    if (!model) throw new LLMError('暂无可用模型', 'no_model')
    let text = ''
    let reasoning = ''
    let usage: LLMResult['usage']
    const messages = rest.messages.map((m) => ({
      role: m.role,
      content:
        typeof m.content === 'string'
          ? m.content
          : (m.content as LLMContentPart[])
              .map((p) =>
                p.type === 'text'
                  ? p.text
                  : { type: 'image_url', image_url: { url: p.image_url!.url } },
              )
              .map((p: any) => (typeof p === 'string' ? p : p))
              .join('\n'),
    }))
    /* 超时保护：避免个别模型卡住导致界面一直转圈 */
    const inner = new AbortController()
    const onOuter = () => inner.abort()
    rest.signal?.addEventListener('abort', onOuter)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      inner.abort()
    }, 180000)
    try {
      const stream = await cloud.llm.chat.completions.create({
        model: model.id,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: rest.temperature ?? 0.7,
        conversationId: rest.conversationId,
        signal: inner.signal,
      })
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta
        if (delta?.content) {
          text += delta.content
          onDelta(delta.content)
        }
        if (delta?.reasoning_content) reasoning += delta.reasoning_content
        if (chunk.usage) usage = chunk.usage as any
      }
    } catch (e: any) {
      if (timedOut) throw new LLMError('模型响应超时（180 秒），请重试或在设置中更换模型', 'timeout')
      if (text) return { text, reasoning, usage, model: model.id, channel: 'workbuddy' }
      throw e
    } finally {
      clearTimeout(timer)
      rest.signal?.removeEventListener('abort', onOuter)
    }
    return { text, reasoning, usage, model: model.id, channel: 'workbuddy' }
  }

  const target = { baseURL: cfg.baseURL, apiKey: cfg.apiKey, model: cfg.model }

  if (!target.apiKey || !target.baseURL || !target.model) {
    throw new LLMError('尚未配置可用的大模型通道，请到「设置」中完成配置', 'no_provider')
  }

  return openAIStream(target, rest, onDelta)
}

/** 一次性调用（内部走流式再收集），用于结构化输出 */
export async function callLLM(
  cfg: LLMConfig,
  opts: LLMCallOptions,
): Promise<string> {
  let out = ''
  const res = await streamLLM(cfg, { ...opts, onDelta: (d) => (out += d) })
  return res.text || out
}

/** 要求模型返回 JSON（自动剥离 ``` 包裹） */
export async function callJSON<T = any>(
  cfg: LLMConfig,
  opts: LLMCallOptions & { jsonHint?: string },
): Promise<T> {
  const hint = opts.jsonHint ?? ''
  const messages = opts.messages.map((m, i) =>
    i === 0 && m.role === 'system'
      ? { ...m, content: `${m.content}\n\n只输出 JSON，不要任何解释文字、不要 Markdown 代码块包裹。${hint}` }
      : m,
  )
  const raw = await callLLM(cfg, { ...opts, messages })
  return parseJSON<T>(raw)
}

export function parseJSON<T = any>(raw: string): T {
  let s = (raw || '').trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = s.search(/[[{]/)
  if (start > 0) s = s.slice(start)
  try {
    return JSON.parse(s)
  } catch {
    // 容错：截取最后一个完整的 JSON 块
    for (let end = s.length; end > 0; end--) {
      const cand = s.slice(0, end)
      const last = cand.lastIndexOf('}')
      if (last > 0) {
        try {
          return JSON.parse(cand.slice(0, last + 1))
        } catch {
          /* continue */
        }
      }
    }
    throw new LLMError('模型返回内容不是合法 JSON', 'bad_json')
  }
}

/* ------------------------------------------------------------
   演示模式：离线可完整体验 UI 流程
------------------------------------------------------------ */
const DEMO_REPLIES: Record<string, string> = {
  default: `> **演示模式**：当前未配置真实模型，下面的内容是内置样例，用来展示 StudyBuddy 的交互形态。配置任意一种通道后即可获得真实推理。

### 这是什么
选中文档中的一段话，AI 助教会围绕**它**展开解释，而不是泛泛而谈。

### 举一个例子
> 文档原文：「梯度下降沿负梯度方向迭代更新参数」
>
> 类比：像下山，每一步都沿"最陡的下坡方向"走一点，走到最后就是谷底（极小值）。

### 可视化理解
\`\`\`mermaid
flowchart LR
  A[当前参数 θ] --> B[计算梯度 ∇L]
  B --> C[更新 θ ← θ − η∇L]
  C --> A
  C -.收敛.-> D[极小值]
\`\`\`

### 公式拆解
$$
\theta_{t+1} = \theta_t - \eta \nabla_\theta L(\theta_t)
$$

其中 $\\eta$ 是学习率，控制每一步走多远。

### 动手检验
1. 若把 $\\eta$ 调大 10 倍，可能出现什么现象？（提示：震荡或发散）
2. 为什么在鞍点附近梯度下降会变慢？`,

  quiz: `### 随堂检验（演示样例）

**Q1.** 梯度下降的更新公式是？
- A. $\\theta_{t+1} = \\theta_t + \\eta \\nabla L$
- B. $\\theta_{t+1} = \\theta_t - \\eta \\nabla L$ ✅
- C. $\\theta_{t+1} = \\theta_t / (\\eta \\nabla L)$

**Q2.** 学习率过大最可能导致？
- A. 收敛过慢
- B. 参数震荡或发散 ✅
- C. 梯度消失

> 配置模型后，这里会依据你的文档自动生成题目并逐题批改。`,

  research: `### 文献线索（演示样例）

1. **Deep Learning** — Goodfellow, Bengio, Courville · 2016 · [books.google.com](https://www.deeplearningbook.org/)
2. **An Introduction to Statistical Learning** — James, Witten, Hastie, Tibshirani
3. **Understanding the difficulty of training deep feedforward neural networks** — Glorot & Bengio

> 真实模式会通过 Semantic Scholar / OpenAlex 检索可点击的真实论文链接。`,
}

async function demoStream(opts: LLMCallOptions, onDelta: (d: string) => void): Promise<LLMResult> {
  const last = [...opts.messages].reverse().find((m) => m.role === 'user')
  const raw = String((last?.content as string) ?? '')
  // 上下文中包含文档片段，可能干扰意图判断，这里只取用户真实提问部分
  const marker = raw.indexOf('【用户问题】')
  const text = marker >= 0 ? raw.slice(marker + 6).trim() : raw
  let body = DEMO_REPLIES.default
  if (/题|测验|quiz|练习/i.test(text)) body = DEMO_REPLIES.quiz
  else if (/论文|文献|research|调研|资料/i.test(text)) body = DEMO_REPLIES.research

  const chunks = body.match(/[\s\S]{1,12}/g) ?? [body]
  for (const c of chunks) {
    if (opts.signal?.aborted) throw new LLMError('已取消', 'aborted')
    onDelta(c)
    await new Promise((r) => setTimeout(r, 12))
  }
  return { text: body, channel: 'demo', model: 'demo-offline' }
}
