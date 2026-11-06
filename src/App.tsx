import { useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { applyTheme, useApp } from './store/app'
import { Sidebar } from './components/layout/Sidebar'
import { RightPanel } from './components/layout/RightPanel'
import { Resizer } from './components/layout/Resizer'
import { HomeView } from './views/HomeView'
import { ChatView } from './views/ChatView'
import { LibraryView } from './views/LibraryView'
import { ReadingView } from './components/reading/ReadingView'
import { KnowledgeView } from './views/KnowledgeView'
import { MemoryView } from './views/MemoryView'
import { QuizView } from './views/QuizView'
import { GrowthView } from './views/GrowthView'
import { ResearchView } from './views/ResearchView'
import { SettingsView } from './views/SettingsView'
import { seedIfEmpty } from './lib/seed'
import { useAccount } from './lib/account'
import pikaImg from './assets/pika-bg.png'

export default function App() {
  const { settings, view, toast, patchSettings } = useApp()

  /* 进入「沉浸式阅读」时自动收起右侧学习台，给文档与对话留出空间 */
  const rightBefore = useRef<boolean | null>(null)
  useEffect(() => {
    if (view === 'reading') {
      if (rightBefore.current === null) {
        rightBefore.current = !settings.rightCollapsed
        if (!settings.rightCollapsed) patchSettings({ rightCollapsed: true })
      }
    } else if (rightBefore.current !== null) {
      patchSettings({ rightCollapsed: rightBefore.current })
      rightBefore.current = null
    }
  }, [view])

  /* 主题同步 */
  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  /* 皮卡丘主题的背景图（由 Vite 打包，路径随部署自动正确） */
  useEffect(() => {
    document.documentElement.style.setProperty('--pika-img', `url(${pikaImg})`)
  }, [])

  /* 首次运行：植入示例资料，让访客立刻看到完整形态 */
  useEffect(() => {
    seedIfEmpty().catch(() => undefined)
  }, [])

  /* 恢复 / 兑换 WorkBuddy 登录态
     —— 回调必须在路由守卫之前处理，否则 code 会被丢弃 */
  const restore = useAccount((s) => s.restore)
  const user = useAccount((s) => s.user)
  useEffect(() => {
    restore()
  }, [restore])

  /* 登录成功后自动切到 WorkBuddy 账号通道（此时消耗的是访客自己的积分） */
  const prevUser = useRef<string | null>(null)
  const restored = useAccount((s) => s.restored)
  useEffect(() => {
    if (!restored) return
    const uid = user?.id ?? user?.nickname ?? null
    const st = useApp.getState()
    if (uid) {
      // 登录成功：切到 WorkBuddy 账号通道，调用计入访客自己的积分
      if (prevUser.current === null && st.settings.llm.channel === 'demo') {
        st.patchLLM({ channel: 'workbuddy', demoMode: false })
      }
    } else if (st.settings.llm.channel === 'workbuddy') {
      // 未登录：不让任何人消耗作者额度，回落到演示模式
      st.patchLLM({ channel: 'demo', demoMode: true })
    }
    prevUser.current = uid
  }, [user, restored])


  /* 首次运行：植入示例资料，让访客立刻看到完整形态 */
  useEffect(() => {
    seedIfEmpty().catch(() => undefined)
  }, [])



  /* 快捷键：⌘/Ctrl + K 新建对话 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useApp.getState().setView('home')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        patchSettings({ leftCollapsed: !settings.leftCollapsed })
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        patchSettings({ rightCollapsed: !settings.rightCollapsed })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.leftCollapsed, settings.rightCollapsed, patchSettings])

  return (
    <div className="relative z-10 flex h-full w-full overflow-hidden">
      {!settings.leftCollapsed && <Sidebar />}
      <Resizer side="left" min={180} max={420} defaultWidth={232} />

      <main className="relative z-10 min-w-0 flex-1 overflow-hidden bg-[var(--bg)]">
        {/* 皮卡丘主题的淡化水印：位于内容之下、主区底色之上 */}
        {settings.theme === 'pika' && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <img
              src={pikaImg}
              alt=""
              className="absolute right-4 top-1/2 h-[88%] -translate-y-1/2 object-contain opacity-95"
            />
          </div>
        )}
        <div className="relative z-10 h-full">
          <ViewSwitch view={view} />
        </div>
      </main>

      <Resizer side="right" min={260} max={560} defaultWidth={320} />
      {!settings.rightCollapsed && <RightPanel />}

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 animate-fade-up">
          <div
            className={`glass flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] shadow-[var(--shadow-lg)] ${
              toast.tone === 'bad'
                ? 'text-danger'
                : toast.tone === 'good'
                  ? 'text-good'
                  : 'text-ink-soft'
            }`}
          >
            {toast.tone === 'bad' ? (
              <AlertCircle size={14} />
            ) : toast.tone === 'good' ? (
              <CheckCircle2 size={14} />
            ) : (
              <Info size={14} />
            )}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  )
}

function ViewSwitch({ view }: { view: string }) {
  switch (view) {
    case 'chat':
      return <ChatView />
    case 'reading':
      return <ReadingView />
    case 'library':
      return <LibraryView />
    case 'knowledge':
      return <KnowledgeView />
    case 'memory':
      return <MemoryView />
    case 'quiz':
      return <QuizView />
    case 'growth':
      return <GrowthView />
    case 'research':
      return <ResearchView />
    case 'settings':
      return <SettingsView />
    case 'home':
    default:
      return <HomeView />
  }
}
