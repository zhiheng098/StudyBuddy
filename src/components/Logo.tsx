/* ============================================================
   StudyBuddy · 品牌标识（橙 + 蓝，参考 DeepTutor 视觉）
   ============================================================ */

export function LogoMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-label="StudyBuddy logo"
    >
      <defs>
        <linearGradient id="sbOr" x1="4" y1="4" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF9D2E" />
          <stop offset="1" stopColor="#F2620B" />
        </linearGradient>
        <linearGradient id="sbBl" x1="36" y1="6" x2="20" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#59A5F5" />
          <stop offset="1" stopColor="#2A62C8" />
        </linearGradient>
        <linearGradient id="sbPage" x1="20" y1="12" x2="20" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#E8F1FE" />
        </linearGradient>
      </defs>
      {/* 橙色书页 */}
      <path
        d="M19.4 13.6c-3-2.4-6.6-3.2-10.4-2.4a1.6 1.6 0 0 0-1.5 1.6v14.9c0 1 .9 1.8 1.9 1.6 3.4-.6 6.7 0 9.4 2.1.4.3.9.3 1.3 0V14.9c0-.5-.2-.9-.7-1.3Z"
        fill="url(#sbOr)"
      />
      {/* 蓝色书页 */}
      <path
        d="M20.6 13.6c3-2.4 6.6-3.2 10.4-2.4a1.6 1.6 0 0 1 1.5 1.6v14.9c0 1-.9 1.8-1.9 1.6-3.4-.6-6.7 0-9.4 2.1-.4.3-.9.3-1.3 0V14.9c0-.5.2-.9.7-1.3Z"
        fill="url(#sbBl)"
      />
      {/* 中缝 */}
      <path d="M20 13.2v19.8" stroke="url(#sbPage)" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
      {/* 灵感星火 */}
      <path
        d="M20 4.2l1.28 3.06a3.2 3.2 0 0 0 1.86 1.86L26.2 10.4l-3.06 1.28a3.2 3.2 0 0 0-1.86 1.86L20 16.6l-1.28-3.06a3.2 3.2 0 0 0-1.86-1.86L13.8 10.4l3.06-1.28a3.2 3.2 0 0 0 1.86-1.86L20 4.2Z"
        fill="#FFC24B"
      />
    </svg>
  )
}

export function LogoWord({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <LogoMark size={26} />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">
          <span className="brand-grad">Study</span>
          <span className="brand-grad">Buddy</span>
        </span>
      )}
    </div>
  )
}
