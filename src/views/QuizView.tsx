import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  ClipboardList,
  Filter,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { db } from '../lib/db'
import { generateQuestions, gradeAnswer, recordAttempt } from '../lib/actions'
import { useApp } from '../store/app'
import type { Question, QuestionType } from '../types'

const TYPE_LABEL: Record<QuestionType, string> = {
  choice: '单选',
  multi: '多选',
  judge: '判断',
  short: '简答',
  code: '代码',
  proof: '证明',
}

export function QuizView() {
  const { settings, notify } = useApp()
  const [questions, setQuestions] = useState<Question[]>([])
  const [attempts, setAttempts] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [tab, setTab] = useState<'bank' | 'practice' | 'wrong'>('bank')
  const [docId, setDocId] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [practice, setPractice] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, { score: number; correct: boolean; feedback: string }>>({})
  const [grading, setGrading] = useState(false)

  const load = async () => {
    const [q, a, d] = await Promise.all([
      db.questions.orderBy('createdAt').reverse().toArray(),
      db.attempts.orderBy('createdAt').reverse().toArray(),
      db.docs.toArray(),
    ])
    setQuestions(q)
    setAttempts(a)
    setDocs(d)
  }
  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () =>
      questions.filter(
        (q) => (docId ? q.docId === docId : true) && (typeFilter === 'all' ? true : q.type === typeFilter),
      ),
    [questions, docId, typeFilter],
  )

  const wrongIds = useMemo(
    () => new Set(attempts.filter((a) => !a.correct).map((a) => a.questionId)),
    [attempts],
  )

  const gen = async () => {
    if (!docId) {
      notify('请先选择一份资料', 'info')
      return
    }
    const doc = docs.find((d) => d.id === docId)
    if (!doc) return
    setLoading(true)
    try {
      const qs = await generateQuestions(settings.llm, {
        source: doc.text || doc.preview,
        docId: doc.id,
        docName: doc.name,
        count: 6,
      })
      notify(qs.length ? `已生成 ${qs.length} 道题` : '未能生成题目', qs.length ? 'good' : 'info')
      await load()
      if (qs.length) {
        setPractice(qs)
        setAnswers({})
        setResults({})
        setTab('practice')
      }
    } catch (e: any) {
      notify(e?.message ?? '出题失败', 'bad')
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (!practice.length) return
    setGrading(true)
    const res: typeof results = {}
    for (const q of practice) {
      const ans = answers[q.id] ?? ''
      if (!ans.trim()) continue
      if (q.type === 'choice' || q.type === 'judge' || q.type === 'multi') {
        const ok = ans.trim() === q.answer.trim()
        const r = {
          score: ok ? 100 : 0,
          correct: ok,
          feedback: ok ? '回答正确 ✅' : `正确答案：${q.answer}。${q.explanation ?? ''}`,
        }
        res[q.id] = r
        await recordAttempt(q, ans, r)
      } else {
        try {
          const r = await gradeAnswer(settings.llm, { question: q, userAnswer: ans })
          res[q.id] = r
          await recordAttempt(q, ans, r)
        } catch {
          res[q.id] = { score: 0, correct: false, feedback: '批改失败' }
        }
      }
    }
    setResults(res)
    await load()
    setGrading(false)
    const scores = Object.values(res).map((r) => r.score)
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    notify(`本次得分 ${avg} 分`, avg >= 60 ? 'good' : 'info')
  }

  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-4xl px-6 py-7">
        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-ink">
              <ClipboardList size={19} className="text-primary" />
              题库与练习
            </h1>
            <p className="mt-1 text-[12.5px] text-ink-mute">
              按资料自动出题 → 自动批改 → 错题归档，形成可持续的刻意练习闭环。
            </p>
          </div>
        </header>

        {/* Tabs */}
        <div className="mt-5 flex gap-1.5">
          {(
            [
              { k: 'bank', label: `题库 (${questions.length})` },
              { k: 'practice', label: '练习' },
              { k: 'wrong', label: `错题本 (${wrongIds.size})` },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] transition ${
                tab === t.k ? 'bg-primary-soft font-medium text-primary' : 'text-ink-mute hover:bg-panel-2 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'bank' && (
          <>
            {/* 生成 */}
            <div className="card mt-4 flex flex-wrap items-center gap-3 p-3.5">
              <select
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                className="min-w-[200px] rounded-lg border bg-panel-2 px-2.5 py-2 text-[12.5px] outline-none focus:border-primary/50"
              >
                <option value="">选择要出题的资料…</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={gen}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-primary px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                AI 出题
              </button>
              <div className="ml-auto flex items-center gap-2">
                <Filter size={13} className="text-ink-mute" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border bg-panel-2 px-2 py-1.5 text-[12px] outline-none"
                >
                  <option value="all">全部题型</option>
                  {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 列表 */}
            <div className="mt-4 space-y-2.5">
              {filtered.length === 0 && (
                <div className="rounded-xl border border-dashed py-12 text-center text-[12.5px] text-ink-mute">
                  题库还是空的，选一份资料点「AI 出题」开始
                </div>
              )}
              {filtered.map((q) => (
                <div key={q.id} className="card group p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 rounded bg-panel-2 px-1.5 py-[2px] text-[10px] text-ink-mute">
                      {TYPE_LABEL[q.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-relaxed text-ink">{q.stem}</p>
                      {q.options && (
                        <ul className="mt-2 space-y-1">
                          {q.options.map((o, i) => (
                            <li
                              key={i}
                              className={`rounded-lg px-2.5 py-1.5 text-[12px] ${
                                o === q.answer ? 'bg-good/10 text-good' : 'bg-panel-2 text-ink-soft'
                              }`}
                            >
                              {String.fromCharCode(65 + i)}. {o}
                              {o === q.answer && ' ✓'}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!q.options && (
                        <p className="mt-2 rounded-lg bg-panel-2 px-2.5 py-1.5 text-[12px] text-ink-soft">
                          参考答案：{q.answer}
                        </p>
                      )}
                      {q.explanation && (
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-mute">解析：{q.explanation}</p>
                      )}
                      <p className="mt-1.5 text-[10.5px] text-ink-mute">
                        难度 {'●'.repeat(q.difficulty)}
                        {'○'.repeat(5 - q.difficulty)}
                        {q.docName ? ` · ${q.docName}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await db.questions.delete(q.id)
                        load()
                      }}
                      className="rounded p-1 text-ink-mute opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'practice' && (
          <div className="mt-4">
            {practice.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center text-[12.5px] text-ink-mute">
                在题库中选一份资料点「AI 出题」，或直接点击下面开始练习
                <div className="mt-3">
                  <button
                    onClick={() => {
                      const pool = filtered.slice(0, 5)
                      if (!pool.length) {
                        notify('题库为空', 'info')
                        return
                      }
                      setPractice(pool)
                      setAnswers({})
                      setResults({})
                    }}
                    className="rounded-lg border px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-primary/40 hover:text-primary"
                  >
                    <Play size={11} className="mr-1 inline" />
                    从题库随机抽 5 题
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {practice.map((q, qi) => {
                    const r = results[q.id]
                    return (
                      <div key={q.id} className="card p-4">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[11px] font-semibold text-primary">
                            {qi + 1}
                          </span>
                          <p className="flex-1 text-[13.5px] leading-relaxed text-ink">{q.stem}</p>
                          {r && (
                            <span
                              className={`rounded px-1.5 py-[2px] text-[10.5px] ${
                                r.correct ? 'bg-good/12 text-good' : 'bg-danger/12 text-danger'
                              }`}
                            >
                              {r.score} 分
                            </span>
                          )}
                        </div>

                        {q.options ? (
                          <div className="mt-2.5 space-y-1.5 pl-7">
                            {q.options.map((o, i) => {
                              const picked = answers[q.id] === o
                              const isAnswer = o === q.answer
                              return (
                                <button
                                  key={i}
                                  disabled={!!r}
                                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition ${
                                    isAnswer && r
                                      ? 'bg-good/12 text-good'
                                      : picked
                                        ? 'bg-primary-soft text-primary'
                                        : 'bg-panel-2 text-ink-soft hover:bg-primary-soft/50'
                                  }`}
                                >
                                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[9px]">
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  {o}
                                  {isAnswer && r && <Check size={13} className="ml-auto" />}
                                  {picked && !isAnswer && r && <X size={13} className="ml-auto text-danger" />}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <textarea
                            disabled={!!r}
                            value={answers[q.id] ?? ''}
                            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                            rows={3}
                            placeholder="写下你的思路或答案…"
                            className="mt-2.5 w-full resize-none rounded-lg border bg-panel-2 px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-primary/50 disabled:opacity-70"
                          />
                        )}

                        {r && (
                          <div
                            className={`mt-2.5 rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                              r.correct ? 'bg-good/8 text-good' : 'bg-danger/8 text-danger'
                            }`}
                          >
                            {r.feedback}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {!Object.keys(results).length ? (
                    <button
                      onClick={submit}
                      disabled={grading}
                      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-primary px-4 py-2 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
                    >
                      {grading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      提交并批改
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setPractice([])
                          setAnswers({})
                          setResults({})
                        }}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] text-ink-soft transition hover:border-primary/40 hover:text-primary"
                      >
                        <RotateCcw size={13} />
                        再来一组
                      </button>
                      <span className="text-[12px] text-ink-mute">
                        平均得分{' '}
                        <b className="text-ink">
                          {Object.values(results).length
                            ? Math.round(
                                Object.values(results).reduce((a, b) => a + b.score, 0) /
                                  Object.values(results).length,
                              )
                            : 0}
                        </b>{' '}
                        分
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'wrong' && (
          <div className="mt-4 space-y-2.5">
            {attempts.filter((a) => !a.correct).length === 0 && (
              <div className="rounded-xl border border-dashed py-12 text-center text-[12.5px] text-ink-mute">
                还没有错题 —— 保持住！
              </div>
            )}
            {attempts
              .filter((a) => !a.correct)
              .map((a) => {
                const q = questions.find((x) => x.id === a.questionId)
                return (
                  <div key={a.id} className="card p-3.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-relaxed text-ink">{a.questionStem ?? q?.stem}</p>
                        <p className="mt-1.5 text-[11.5px] text-ink-soft">你的作答：{a.userAnswer || '（空）'}</p>
                        {q && (
                          <p className="mt-1 text-[11.5px] text-good">
                            正确答案：{q.answer}
                          </p>
                        )}
                        {a.feedback && (
                          <p className="mt-1.5 rounded-lg bg-panel-2 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-ink-soft">
                            {a.feedback}
                          </p>
                        )}
                        <p className="mt-1.5 text-[10.5px] text-ink-mute">
                          {new Date(a.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await db.attempts.delete(a.id)
                          load()
                        }}
                        className="rounded p-1 text-ink-mute transition hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
