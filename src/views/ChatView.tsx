import { useEffect } from 'react'
import { ChatPanel } from '../components/chat/ChatPanel'
import { db } from '../lib/db'
import { useApp } from '../store/app'

export function ChatView() {
  const { conversationId, setConversationId, consumePendingPrompt } = useApp()

  /* 从首页 / 知识图谱 / 文献库跳转过来时，自动发出待处理的问题 */
  useEffect(() => {
    const p = consumePendingPrompt()
    if (!p) return
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('sb:ask', { detail: p }))
    }, 80)
    return () => clearTimeout(t)
  }, [consumePendingPrompt])

  return (
    <div className="h-full">
      <ChatPanel
        conversationId={conversationId}
        onNeedConversation={async () => {
          const id = `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
          await db.conversations.add({
            id,
            title: '新对话',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            mode: 'chat',
          })
          setConversationId(id)
          return id
        }}
      />
    </div>
  )
}
