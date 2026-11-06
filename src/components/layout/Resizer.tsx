import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../../store/app'

interface Props {
  side: 'left' | 'right'
  min: number
  max: number
  defaultWidth: number
}

/**
 * 可横向拖拽伸缩的分隔条 —— 与 WorkBuddy 侧栏交互一致：
 * 按住拖动调整宽度，双击恢复默认宽度；侧栏收起后此处保留一个窄条用于唤回。
 */
export function Resizer({ side, min, max, defaultWidth }: Props) {
  const { settings, patchSettings } = useApp()
  const [active, setActive] = useState(false)
  const startRef = useRef<{ x: number; w: number } | null>(null)

  const widthKey = side === 'left' ? 'leftWidth' : 'rightWidth'
  const collapsedKey = side === 'left' ? 'leftCollapsed' : 'rightCollapsed'
  const collapsed = settings[collapsedKey]

  useEffect(() => {
    if (!active) return
    const onMove = (e: PointerEvent) => {
      if (!startRef.current) return
      const dx = e.clientX - startRef.current.x
      const raw = side === 'left' ? startRef.current.w + dx : startRef.current.w - dx
      const w = Math.max(min, Math.min(max, raw))
      patchSettings({ [widthKey]: w } as any)
    }
    const onUp = () => {
      setActive(false)
      startRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [active, min, max, side, widthKey, patchSettings])

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    startRef.current = { x: e.clientX, w: settings[widthKey] }
    setActive(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  if (collapsed) {
    return (
      <button
        className="group relative z-20 flex w-[18px] shrink-0 items-start justify-center pt-3 transition hover:bg-primary-soft/70"
        title="展开侧栏"
        onClick={() => patchSettings({ [collapsedKey]: false } as any)}
      >
        <span className="rounded p-1 text-ink-mute opacity-40 transition group-hover:opacity-100">
          {side === 'left' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </span>
      </button>
    )
  }

  return (
    <div
      className={`drag-handle z-20 w-[6px] shrink-0 ${active ? 'active' : ''}`}
      onPointerDown={onDown}
      onDoubleClick={() => patchSettings({ [widthKey]: defaultWidth } as any)}
      title="拖动调整宽度 · 双击复位"
    />
  )
}

export function CollapseButton({ side }: { side: 'left' | 'right' }) {
  const { settings, patchSettings } = useApp()
  const key = side === 'left' ? 'leftCollapsed' : 'rightCollapsed'
  const collapsed = settings[key]
  return (
    <button
      className="rounded-md p-1.5 text-ink-mute transition hover:bg-panel-2 hover:text-ink"
      title={collapsed ? '展开侧栏' : '收起侧栏'}
      onClick={() => patchSettings({ [key]: !collapsed } as any)}
    >
      {side === 'left' ? (
        collapsed ? (
          <ChevronRight size={15} />
        ) : (
          <ChevronLeft size={15} />
        )
      ) : collapsed ? (
        <ChevronLeft size={15} />
      ) : (
        <ChevronRight size={15} />
      )}
    </button>
  )
}
