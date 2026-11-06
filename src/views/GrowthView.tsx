import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sparkles,
  Star,
  Target,
} from 'lucide-react'
import { db } from '../lib/db'
import {
  checkModule,
  digestModule,
  generateDiagnostic,
  generateModules,
  scoreDiagnostic,
} from '../lib/actions'
import { galaxyProgress, describeDue, isDue } from '../lib/srs'
import { useApp } from '../store/app'
import { Markdown } from '../components/Markdown'
import type { Diagnostic, GrowthModule } from '../types'


export function GrowthView() {
  const { settings, notify } = useApp()
  const [docs, setDocs] = useState<any[]>([])
  const [docId, setDocId] = useState('')
  const [modules, setModules] = useState<GrowthModule[]>([])
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null)
  const [diagAnswers, setDiagAnswers] = useState<Record<string, string>>({})
  const [diagResult, setDiagResult] = useState<{ overall: number; perModule: any } | null>(null)
  const [active, setActive] = useState<GrowthModule | null>(null)
  const [busy, setBusy] = useState('')
  const [checkQs, setCheckQs] = useState<any[]>([])
  const [checkAnswers, setCheckAnswers] = useState<Record<string, string>>({})
  const [checkResult, setCheckResult] = useState<{ score: number; feedback: string } | null>(null)

  const load = async () => {
    const [d, m] = await Promise.all([db.docs.toArray(), db.modules.toArray()])
    setDocs(d)
    setModules(m.sort((a: any, b: any) => a.order - b.order))
    if (!docId && d.length) setDocId(d[0].id)
  }
  useEffect(() => {
    load()
  }, [])

  const doc = docs.find((d) => d.id === docId)
  const docModules = modules.filter((m) => m.docId === docId)

  const stats = useMemo(() => {
    const mastered = docModules.filter((m) => m.status === 'mastered').length
    const avg = docModules.length
      ? docModules.reduce((a: number, b: any) => a + (b.mastery ?? 0), 0) / docModules.length
      : 0
    const stars = galaxyProgress(mastered, docModules.length, avg)
    const due = docModules.filter((m) => m.status === 'mastered' && isDue(m.nextReviewAt)).length
    return {
      mastered,
      avg,
      stars,
      due,
      digested: docModules.filter((m) => m.status !== 'todo').length,
      checked: docModules.filter((m) => m.status === 'checked' || m.status === 'mastered').length,
      reviewed: docModules.filter((m) => m.lastReviewAt).length,
      total: docModules.length,
    }
  }, [docModules])

  /* ---------- 水平诊断 ---------- */
  const startDiagnose = async () => {
    if (!doc) {
      notify('请先选择一份资料', 'info')
      return
    }
    setBusy('diagnose')
    try {
      const d = await generateDiagnostic(settings.llm, {
        docId: doc.id,
        docName: doc.name,
        content: doc.text || doc.preview,
      })
      setDiagnostic(d)
      setDiagAnswers({})
      setDiagResult(null)
      notify(`诊断题已生成（${d.questions.length} 题）`, 'good')
    } catch (e: any) {
      notify(e?.message ?? '诊断生成失败', 'bad')
    } finally {
      setBusy('')
    }
  }

  const submitDiagnose = async () => {
    if (!diagnostic) return
    diagnostic.answers = { ...diagAnswers }
    const { perModule, overall } = scoreDiagnostic(diagnostic)
    setDiagResult({ overall, perModule })
    await db.diagnostics.put(diagnostic)
    notify(`水平诊断完成：${overall} 分`, overall >= 60 ? 'good' : 'info')
  }

  const buildModules = async () => {
    if (!doc) return
    setBusy('modules')
    try {
      const ms = await generateModules(settings.llm, {
        docId: doc.id,
        docName: doc.name,
        content: doc.text || doc.preview,
      })
      // 依据诊断表现初始化掌握度
      for (const m of ms) {
        const key = Object.keys(diagResult?.perModule ?? {}).find((k) => m.title.includes(k) || k.includes(m.title))
        const perf = key ? diagResult!.perModule[key] : undefined
        m.mastery = perf && perf.total ? perf.correct / perf.total : 0.1
        if (m.mastery >= 0.8) m.status = 'mastered'
        else if (m.mastery >= 0.5) m.status = 'checked'
        await db.modules.put(m)
      }
      await load()
      notify(`已拆解为 ${ms.length} 个知识模块`, 'good')
      setDiagnostic(null)
      setDiagResult(null)
    } catch (e: any) {
      notify(e?.message ?? '模块生成失败', 'bad')
    } finally {
      setBusy('')
    }
  }

  /* ---------- 模块消化 ---------- */
  const doDigest = async (m: GrowthModule) => {
    if (!doc) return
    setActive(m)
    setBusy('digest')
    try {
      await digestModule(settings.llm, {
        module: m,
        content: doc.text || doc.preview,
      })
      await load()
      notify('模块讲解已生成', 'good')
    } catch (e: any) {
      notify(e?.message ?? '讲解失败', 'bad')
    } finally {
      setBusy('')
    }
  }

  /* ---------- 模块检验 ---------- */
  const doCheck = async (m: GrowthModule) => {
    if (!doc) return
    setActive(m)
    setCheckQs([])
    setCheckAnswers({})
    setCheckResult(null)
    setBusy('check')
    try {
      const { questions } = await checkModulePreview(settings, m, doc)
      setCheckQs(questions)
      notify('检验题已生成', 'good')
    } catch (e: any) {
      notify(e?.message ?? '出题失败', 'bad')
    } finally {
      setBusy('')
    }
  }

  const submitCheck = async () => {
    if (!active || !doc) return
    setBusy('grading')
    try {
      const r = await checkModule(settings.llm, {
        module: active,
        content: doc.text || doc.preview,
        answers: checkAnswers,
      })
      setCheckResult({ score: r.score, feedback: '已完成批改并更新掌握度与复习排期' })
      await load()
      notify(`检验得分 ${r.score}`, r.score >= 60 ? 'good' : 'info')
    } catch (e: any) {
      notify(e?.message ?? '批改失败', 'bad')
    } finally {
      setBusy('')
    }
  }

  const stars = useMemo(() => {
    // 生成星点装饰
    const arr: { x: number; y: number; s: number; d: number }[] = []
    for (let i = 0; i < 70; i++) {
      arr.push({
        x: (i * 37) % 100,
        y: (i * 61) % 100,
        s: 1 + ((i * 7) % 3) * 0.7,
        d: (i % 7) * 0.5,
      })
    }
    return arr
  }, [])

  return (
    <div className="flex h-full min-h-0">
      {/* 主面板 */}
      <div className="scroll-area min-h-0 flex-1 bg-[var(--bg)] px-6 py-6">
        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">星空成长</h1>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-mute">
              每颗星星代表你掌握的一个知识点。诊断水平 → 逐模块消化 → 检验 → 间隔复习，
              分数越高星星越亮，复习排期越靠后。
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={docId}
              onChange={(e) => {
                setDocId(e.target.value)
                setDiagnostic(null)
                setDiagResult(null)
              }}
              className="max-w-[220px] rounded-lg border bg-panel-2 px-2.5 py-2 text-[12.5px] outline-none focus:border-primary/50"
            >
              <option value="">选择资料…</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              onClick={startDiagnose}
              disabled={busy === 'diagnose' || !doc}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-primary px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {busy === 'diagnose' ? <Loader2 size={13} className="animate-spin" /> : <Target size={13} />}
              水平诊断
            </button>
          </div>
        </header>

        {/* 星图面板 */}
        <div className="relative mt-5 overflow-hidden rounded-2xl bg-[#0a1024] p-6 text-white shadow-[var(--shadow-lg)]">
          <div className="starfield">
            {stars.map((s, i) => (
              <i
                key={i}
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: s.s,
                  height: s.s,
                  animationDelay: `${s.d}s`,
                }}
              />
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
              <Star size={12} /> LIGHTUP
            </div>
            <h2 className="mt-2 text-[26px] font-semibold tracking-tight">星空成长</h2>
            <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-white/60">
              每 掌握真实知识点，都会点亮一颗星星。星星会记住你的进度，不会随窗口关闭而清零。
            </p>

            <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[34px] font-semibold leading-none">{stats.stars}</span>
                  <span className="ml-1 text-[13px] text-white/45">/120 颗星</span>
                </div>
                <span className="text-[12px] text-white/55">
                  完成模块 {stats.mastered}/{stats.total}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-sky-400 to-orange-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, (stats.stars / 120) * 100)}%` }}
                />
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {[
                  { label: '水平诊断', n: diagnostic ? 1 : 0 },
                  { label: '逐模块消化', n: stats.digested },
                  { label: '检验', n: stats.checked },
                  { label: '复习评分', n: stats.reviewed },
                ].map((t) => (
                  <span
                    key={t.label}
                    className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] text-white/70"
                  >
                    {t.label} <b className="text-white">{t.n}</b>
                  </span>
                ))}
              </div>
              {stats.due > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-orange-300">
                  <RotateCcw size={12} />
                  有 {stats.due} 个模块到复习时间了
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 诊断作答 */}
        {diagnostic && (
          <div className="card mt-5 p-4">
            <div className="flex items-center gap-2">
              <Target size={15} className="text-primary" />
              <h3 className="text-[14px] font-medium text-ink">水平诊断 · {doc?.name}</h3>
              <span className="ml-auto text-[11.5px] text-ink-mute">
                {diagnostic.questions.length} 题
              </span>
            </div>

            <div className="mt-3.5 space-y-3">
              {diagnostic.questions.map((q, i) => (
                <div key={q.id}>
                  <p className="text-[13px] leading-relaxed text-ink">
                    <b className="mr-1.5 text-ink-mute">{i + 1}.</b>
                    {q.stem}
                  </p>
                  {q.options && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {q.options.map((o) => {
                        const picked = diagAnswers[q.id] === o
                        const isRight = diagResult && o === q.answer
                        const isWrongPick = diagResult && picked && o !== q.answer
                        return (
                          <button
                            key={o}
                            onClick={() => setDiagAnswers((a) => ({ ...a, [q.id]: o }))}
                            className={`rounded-lg px-2.5 py-1.5 text-[12px] transition ${
                              isRight
                                ? 'bg-good/15 text-good ring-1 ring-good/40'
                                : isWrongPick
                                  ? 'bg-danger/12 text-danger ring-1 ring-danger/40'
                                  : picked
                                    ? 'bg-primary-soft text-primary ring-1 ring-primary/40'
                                    : 'bg-panel-2 text-ink-soft hover:bg-primary-soft/50'
                            }`}
                          >
                            {o}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {!diagResult ? (
                <button
                  onClick={submitDiagnose}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:brightness-110"
                >
                  <Check size={13} />
                  提交诊断
                </button>
              ) : (
                <>
                  <div className="rounded-lg bg-panel-2 px-3 py-2 text-[12.5px] text-ink-soft">
                    水平得分 <b className="text-ink">{diagResult.overall}</b> 分
                    {diagResult.overall >= 80
                      ? ' · 基础扎实'
                      : diagResult.overall >= 50
                        ? ' · 中等水平'
                        : ' · 建议从头梳理'}
                  </div>
                  <button
                    onClick={buildModules}
                    disabled={busy === 'modules'}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-primary px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    {busy === 'modules' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    自动拆分知识模块
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 模块列表 */}
        <div className="mt-5">
          <h2 className="mb-2.5 text-[13px] font-medium text-ink-soft">
            知识模块 {docModules.length > 0 && `(${docModules.length})`}
          </h2>
          {docModules.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-[12.5px] text-ink-mute">
              {doc
                ? '还没有知识模块。先做一次「水平诊断」，AI 会根据诊断结果自动拆分模块并排出优先级。'
                : '先选择一份资料'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {docModules.map((m, i) => (
                <div key={m.id} className="card group p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{m.title}</span>
                        <span
                          className={`rounded px-1.5 py-[1px] text-[10px] ${
                            m.status === 'mastered'
                              ? 'bg-good/12 text-good'
                              : m.status === 'checked'
                                ? 'bg-primary-soft text-primary'
                                : m.status === 'digesting'
                                  ? 'bg-warn/12 text-warn'
                                  : 'bg-panel-2 text-ink-mute'
                          }`}
                        >
                          {m.status === 'mastered'
                            ? '已掌握'
                            : m.status === 'checked'
                              ? '已检验'
                              : m.status === 'digesting'
                                ? '消化中'
                                : '待开始'}
                        </span>
                        {m.nextReviewAt && (
                          <span className="text-[10.5px] text-ink-mute">
                            下次复习：{describeDue(m.nextReviewAt)}
                          </span>
                        )}
                      </div>
                      {m.outline && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-[11.5px] leading-relaxed text-ink-mute">
                          {m.outline}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-panel-2">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                            style={{ width: `${Math.round((m.mastery ?? 0) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10.5px] text-ink-mute">
                          掌握度 {Math.round((m.mastery ?? 0) * 100)}%
                        </span>
                        <div className="ml-auto flex gap-1.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            onClick={() => doDigest(m)}
                            disabled={busy === 'digest'}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-ink-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                          >
                            <BookOpen size={11} />
                            消化
                          </button>
                          <button
                            onClick={() => doCheck(m)}
                            disabled={busy === 'check'}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-ink-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
                          >
                            <Check size={11} />
                            检验
                          </button>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={15} className="mt-1 shrink-0 text-ink-mute" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧工作台 */}
      {active && (
        <div className="scroll-area w-[360px] shrink-0 border-l bg-[var(--panel-trans)] p-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-primary" />
            <h2 className="flex-1 text-[14px] font-medium text-ink">{active.title}</h2>
            <button onClick={() => setActive(null)} className="rounded p-1 text-ink-mute hover:text-ink">
              ×
            </button>
          </div>

          {busy === 'digest' && (
            <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-ink-mute">
              <Loader2 size={14} className="animate-spin" />
              正在生成模块讲解…
            </div>
          )}

          {active.digestNotes && busy !== 'digest' && (
            <div className="mt-3">
              <Markdown content={active.digestNotes} />
            </div>
          )}

          {checkQs.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2.5 text-[12.5px] font-medium text-ink-soft">检验 · 回答后自动批改</h3>
              <div className="space-y-3">
                {checkQs.map((q, i) => (
                  <div key={q.id}>
                    <p className="text-[12.5px] leading-relaxed text-ink">
                      <b className="mr-1 text-ink-mute">{i + 1}.</b>
                      {q.stem}
                    </p>
                    {q.options ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {q.options.map((o: string) => (
                          <button
                            key={o}
                            onClick={() => setCheckAnswers((a) => ({ ...a, [q.id]: o }))}
                            className={`rounded-lg px-2 py-1 text-[11.5px] transition ${
                              checkAnswers[q.id] === o
                                ? 'bg-primary-soft text-primary ring-1 ring-primary/40'
                                : 'bg-panel-2 text-ink-soft hover:bg-primary-soft/50'
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={checkAnswers[q.id] ?? ''}
                        onChange={(e) => setCheckAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        rows={2}
                        placeholder="写下答案…"
                        className="mt-1.5 w-full resize-none rounded-lg border bg-panel-2 px-2.5 py-1.5 text-[12px] outline-none focus:border-primary/50"
                      />
                    )}
                  </div>
                ))}
              </div>
              {!checkResult ? (
                <button
                  onClick={submitCheck}
                  disabled={busy === 'grading'}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {busy === 'grading' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  提交检验
                </button>
              ) : (
                <div className="mt-3 rounded-lg bg-good/10 px-3 py-2 text-[12px] text-good">
                  本次得分 <b>{checkResult.score}</b> · {checkResult.feedback}
                </div>
              )}
            </div>
          )}

          {!active.digestNotes && busy !== 'digest' && !checkQs.length && (
            <p className="mt-4 text-[12px] leading-relaxed text-ink-mute">
              点击「消化」让 AI 逐条拆解这个模块的要点，再点击「检验」出题验证掌握程度。
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** 生成检验题（不立即批改） */
async function checkModulePreview(settings: any, m: GrowthModule, doc: any) {
  const { generateQuestions } = await import('../lib/actions')
  const questions = await generateQuestions(settings.llm, {
    source: `${m.title}\n${m.outline}\n\n${(doc.text || '').slice(0, 6000)}`,
    docId: m.docId,
    docName: m.docName,
    moduleId: m.id,
    count: 3,
  })
  return { questions }
}
