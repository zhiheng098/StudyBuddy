import { useEffect, useState } from 'react'
import {
  Check,
  Download,
  Loader2,
  Trash2,
  Upload,
  User,
  Zap,
} from 'lucide-react'
import { useApp } from '../store/app'
import { ThemeSwitcher } from '../components/layout/RightPanel'
import { AccountPill } from '../components/AccountChip'
import { checkChannels, listWBModels, type ChannelStatus } from '../lib/llm'
import { displayName, useAccount } from '../lib/account'
import { clearAll, exportAll, importAll } from '../lib/db'
import type { LLMChannel } from '../types'
import { SITE } from '../config/site'

export function SettingsView() {
  const { settings, patchSettings, patchLLM, notify } = useApp()
  const user = useAccount((s) => s.user)
  // 静态兜底：即使云服务探测失败，通道选项也必须可见可切换
  const [channels, setChannels] = useState<ChannelStatus[]>([
    {
      channel: 'workbuddy',
      available: false,
      label: 'WorkBuddy 账号通道',
      hint: '正在检测云服务状态…',
    },
    {
      channel: 'own',
      available: false,
      label: '我自己的 API Key',
      hint: '填写 Base URL / API Key / 模型名后启用',
    },
    {
      channel: 'demo',
      available: true,
      label: '演示模式',
      hint: '内置离线样例响应，可完整体验界面与流程，不调用任何模型',
    },
  ])
  const [wbModels, setWbModels] = useState<any[]>([])
  const [checking, setChecking] = useState(false)
  const [testing, setTesting] = useState(false)

  const refresh = async () => {
    setChecking(true)
    try {
      const res = await checkChannels(settings.llm, {
        signedIn: !!user,
        name: displayName(user),
      })
      setChannels(res)
      setWbModels(await listWBModels())
    } catch (e) {
      notify('云服务状态检测失败：' + ((e as any)?.message ?? '未知错误'), 'bad')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const testOwn = async () => {
    setTesting(true)
    try {
      const { callLLM } = await import('../lib/llm')
      const out = await callLLM({ ...settings.llm, channel: 'own' }, {
        messages: [
          { role: 'system', content: '你是连通性测试助手。' },
          { role: 'user', content: '只回复两个字：可用' },
        ],
        maxTokens: 32,
      })
      notify(out ? `连接成功：${out.slice(0, 30)}` : '连接成功', 'good')
    } catch (e: any) {
      notify(e?.message ?? '连接失败', 'bad')
    } finally {
      setTesting(false)
    }
  }

  const exportData = async () => {
    const json = await exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studybuddy-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify('已导出学习数据', 'good')
  }

  const importData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return
      try {
        await importAll(await f.text())
        notify('导入成功', 'good')
        setTimeout(() => location.reload(), 800)
      } catch (e: any) {
        notify(e?.message ?? '导入失败', 'bad')
      }
    }
    input.click()
  }

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-3xl px-6 py-7">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">设置</h1>
        <p className="mt-1 text-[12.5px] text-ink-mute">模型通道、外观、学习偏好与数据管理。</p>

        {/* 模型通道 */}
        <section className="card mt-5 p-4">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-primary" />
            <h2 className="text-[14px] font-medium text-ink">大模型通道</h2>
            <button
              onClick={refresh}
              className="ml-auto flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-ink-mute transition hover:border-primary/40 hover:text-primary"
            >
              {checking ? <Loader2 size={11} className="animate-spin" /> : null}
              刷新状态
            </button>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
            任意一种通道可用即可开始学习。默认「演示模式」无需任何配置即可体验完整界面。
          </p>

          <div className="mt-3.5 space-y-2">
            {channels.map((c) => (
              <label
                key={c.channel}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  settings.llm.channel === c.channel
                    ? 'border-primary bg-primary-soft/50'
                    : 'hover:border-[var(--border-strong)]'
                }`}
              >
                <input
                  type="radio"
                  name="channel"
                  checked={settings.llm.channel === c.channel}
                  onChange={() => patchLLM({ channel: c.channel as LLMChannel })}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium text-ink">{c.label}</span>
                    <span
                      className={`rounded px-1.5 py-[1px] text-[10px] ${
                        c.available ? 'bg-good/12 text-good' : 'bg-panel-2 text-ink-mute'
                      }`}
                    >
                      {c.available ? '可用' : '未配置'}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-mute">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {/* WorkBuddy */}
          {settings.llm.channel === 'workbuddy' && (
            <div className="mt-3.5 rounded-xl border bg-panel-2 p-3">
              {!user && (
                <div className="mb-3 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5">
                  <p className="text-[12px] font-medium text-warn">需要先登录 WorkBuddy 账号</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                    未登录时模型调用没有身份，计费会落到作品创建者头上 —— 所以本作品已停用该状态下的调用。
                    登录后调用会自动计入<b>你自己的 WorkBuddy 积分</b>。
                  </p>
                  <div className="mt-2">
                    <AccountPill />
                  </div>
                </div>
              )}
              <p className="text-[12px] font-medium text-ink">选择模型</p>
              {wbModels.length === 0 ? (
                <p className="mt-1 text-[11.5px] text-ink-mute">
                  当前部署未启用 WorkBuddy 免密通道。作品通过 WorkBuddy 发布并启用云服务后即可自动出现。
                </p>
              ) : (
                <select
                  value={settings.llm.wbModel ?? ''}
                  onChange={(e) => patchLLM({ wbModel: e.target.value })}
                  className="mt-2 w-full rounded-lg border bg-panel px-2.5 py-2 text-[12.5px] outline-none"
                >
                  <option value="">自动选择</option>
                  {wbModels.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.disabled === true}>
                      {m.name ?? m.id}
                      {m.disabled === true ? '（不可用）' : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                {user
                  ? '已登录：调用计入你自己的 WorkBuddy 账号积分，作者不承担任何模型费用。'
                  : '未登录：此通道暂不可用，作品不会代你承担任何模型费用。'}
              </p>
            </div>
          )}

          {/* 自带 Key */}
          {settings.llm.channel === 'own' && (
            <div className="mt-3.5 space-y-2.5 rounded-xl border bg-panel-2 p-3">
              <Field label="Base URL" hint="兼容 OpenAI 协议，如 https://api.deepseek.com/v1">
                <input
                  value={settings.llm.baseURL}
                  onChange={(e) => patchLLM({ baseURL: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="input"
                />
              </Field>
              <Field label="API Key">
                <input
                  type="password"
                  value={settings.llm.apiKey}
                  onChange={(e) => patchLLM({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="input"
                />
              </Field>
              <Field label="模型名">
                <input
                  value={settings.llm.model}
                  onChange={(e) => patchLLM({ model: e.target.value })}
                  placeholder="gpt-4o-mini / deepseek-chat / moonshot-v1-8k"
                  className="input"
                />
              </Field>
              <button
                onClick={testOwn}
                disabled={testing}
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] text-ink-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
              >
                {testing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                测试连接
              </button>
            </div>
          )}

          {/* 通用参数 */}
          <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
            <Field label={`温度 ${settings.llm.temperature}`}>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.1}
                value={settings.llm.temperature}
                onChange={(e) => patchLLM({ temperature: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
              />
            </Field>
            <Field label="最大输出 tokens">
              <input
                type="number"
                value={settings.llm.maxTokens}
                onChange={(e) => patchLLM({ maxTokens: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
        </section>

        {/* 外观 */}
        <section className="card mt-4 p-4">
          <h2 className="text-[14px] font-medium text-ink">外观主题</h2>
          <p className="mt-1 text-[11.5px] text-ink-mute">四套主题即时切换，记住你的选择。</p>
          <div className="mt-3">
            <ThemeSwitcher />
          </div>
        </section>

        {/* 学习偏好 */}
        <section className="card mt-4 p-4">
          <h2 className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
            <User size={15} className="text-primary" />
            学习偏好
          </h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
            这段描述会作为「学习者画像」注入每一次对话，让讲解更贴合你的水平与习惯。
          </p>
          <textarea
            value={settings.persona}
            onChange={(e) => patchSettings({ persona: e.target.value })}
            rows={4}
            placeholder="例如：我是前端开发者，正在补机器学习基础；偏好先看直觉再看公式；解释代码请用 Python；数学基础较弱需要多给推导。"
            className="mt-2.5 w-full resize-none rounded-xl border bg-panel-2 px-3 py-2.5 text-[12.5px] leading-relaxed outline-none transition focus:border-primary/50"
          />
        </section>

        {/* 数据 */}
        <section className="card mt-4 p-4">
          <h2 className="text-[14px] font-medium text-ink">数据管理</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
            所有资料、笔记、知识点、题库与记忆都保存在本机浏览器（IndexedDB），不会上传到任何服务器。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={exportData}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] text-ink-soft transition hover:border-primary/40 hover:text-primary"
            >
              <Download size={13} />
              导出全部数据
            </button>
            <button
              onClick={importData}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] text-ink-soft transition hover:border-primary/40 hover:text-primary"
            >
              <Upload size={13} />
              导入备份
            </button>
            <button
              onClick={async () => {
                if (!confirm('确定清空全部本地数据？此操作不可撤销。')) return
                await clearAll()
                notify('已清空', 'good')
                setTimeout(() => location.reload(), 600)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-2 text-[12px] text-danger transition hover:bg-danger/8"
            >
              <Trash2 size={13} />
              清空所有数据
            </button>
          </div>
        </section>

        <p className="mt-6 text-center text-[11px] text-ink-mute">
          StudyBuddy v{SITE.version} · 为 1024 程序员节 WorkBuddy 造物挑战打造
          {SITE.authorNote ? ` · ${SITE.authorNote}` : ''}
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] text-ink-mute">{hint}</span>}
    </label>
  )
}
