/* ============================================================
   StudyBuddy · 站点级配置
   优先级：环境变量 > 内置默认值
   ============================================================ */

const env = (import.meta as any).env ?? {}

export const SITE = {
  /** 公共体验通道：Base URL，例如 https://api.deepseek.com/v1 */
  sharedBaseURL: (env.VITE_SHARED_BASE_URL ?? '') as string,
  /** 公共体验通道：Key */
  sharedKey: (env.VITE_SHARED_KEY ?? '') as string,
  /** 公共体验通道：模型名 */
  sharedModel: (env.VITE_SHARED_MODEL ?? '') as string,
  /** 每位访客每日可用次数 */
  sharedDailyLimit: Number(env.VITE_SHARED_DAILY_LIMIT ?? 30),
  /** 作者署名 / 说明，展示在设置页 */
  authorNote: (env.VITE_AUTHOR_NOTE ?? '') as string,
  /** 作品版本号 */
  version: (env.VITE_APP_VERSION ?? '1.0.0') as string,
}

export const hasSharedChannel = !!(SITE.sharedBaseURL && SITE.sharedKey && SITE.sharedModel)

/**
 * WorkBuddy 账号通道配置。
 *
 * ⚠️ 关于 publishableKey：它是**公开的应用标识**，不含任何权限，
 *    官方明确允许随前端代码分发（真正的模型凭证始终在服务端）。
 *    但如果你要部署自己的实例，请通过 .env 覆盖成你自己的值：
 *      VITE_WB_ENDPOINT / VITE_WB_PUBLISHABLE_KEY / VITE_WB_OAUTH_RELAY_BASE_URL
 *
 * 直接打进包体而非运行时再请求，是为了兼容线上分享链接对额外路径的访问校验。
 */
export const WB = {
  endpoint: (env.VITE_WB_ENDPOINT ?? 'https://studybuddy-91919.app.workbuddy.host') as string,
  publishableKey: (env.VITE_WB_PUBLISHABLE_KEY ?? 'wbpk_aNS3pCwmYkAV7YfZqGm6Vx_Qo2QIfnFOnphTux20NqQMQK6nzxaWfLy') as string,
  oauthRelayBaseUrl: (env.VITE_WB_OAUTH_RELAY_BASE_URL ?? 'https://www.workbuddy.cn/v2/as/genie-baas/oauth') as string,
}
