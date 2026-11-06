/* ============================================================
   StudyBuddy · 学术检索（Semantic Scholar + OpenAlex，均支持 CORS、免费无需 Key）
   ============================================================ */

import type { Paper } from '../types'

function stripTags(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function yearOf(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 4)
  if (v.year) return String(v.year)
  if (v.publication_date) return String(v.publication_date).slice(0, 4)
  if (v.publication_year) return String(v.publication_year)
  return ''
}

async function searchSemanticScholar(query: string, limit: number): Promise<Paper[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
    query,
  )}&limit=${limit}&fields=title,authors,year,abstract,venue,url,externalIds,citationCount,publicationDate`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Semantic Scholar ${res.status}`)
  const json = await res.json()
  const items: any[] = json?.data ?? []
  return items.map((p) => ({
    id: p.paperId ?? p.title,
    title: p.title ?? 'Untitled',
    authors: (p.authors ?? []).map((a: any) => a.name).join(', ') || '未知作者',
    year: yearOf(p),
    venue: p.venue || undefined,
    abstract: p.abstract ? stripTags(p.abstract) : undefined,
    url: p.url ?? (p.externalIds?.ArXiv ? `https://arxiv.org/abs/${p.externalIds.ArXiv}` : undefined),
    doi: p.externalIds?.DOI,
    source: 'semantic-scholar' as const,
    citations: p.citationCount,
  }))
}

async function searchOpenAlex(query: string, limit: number): Promise<Paper[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(
    query,
  )}&per-page=${limit}&select=id,title,display_name,authorships,publication_year,doi,abstract_inverted_index,primary_location,cited_by_count,ids`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`)
  const json = await res.json()
  const items: any[] = json?.results ?? []
  return items.map((w) => {
    let abstract = ''
    const inv = w.abstract_inverted_index
    if (inv) {
      const positions: { pos: number; word: string }[] = []
      for (const [word, idxs] of Object.entries(inv)) {
        for (const i of idxs as number[]) positions.push({ pos: i, word })
      }
      positions.sort((a, b) => a.pos - b.pos)
      abstract = positions.map((p) => p.word).join(' ').slice(0, 600)
    }
    return {
      id: w.id,
      title: w.display_name ?? w.title ?? 'Untitled',
      authors: (w.authorships ?? [])
        .slice(0, 8)
        .map((a: any) => a.author?.display_name)
        .filter(Boolean)
        .join(', '),
      year: w.publication_year ? String(w.publication_year) : '',
      venue: w.primary_location?.source?.display_name ?? undefined,
      abstract: abstract || undefined,
      url: w.primary_location?.landing_page_url ?? w.doi ?? undefined,
      doi: w.doi ? String(w.doi).replace('https://doi.org/', '') : undefined,
      source: 'openalex' as const,
      citations: w.cited_by_count,
    }
  })
}

/** 双源并行检索并去重合并 */
export async function searchPapers(query: string, limit = 8): Promise<Paper[]> {
  const q = query.trim()
  if (!q) return []
  const settled = await Promise.allSettled([
    searchSemanticScholar(q, limit),
    searchOpenAlex(q, limit),
  ])
  const all: Paper[] = []
  settled.forEach((r) => {
    if (r.status === 'fulfilled') all.push(...r.value)
  })
  const seen = new Set<string>()
  const merged: Paper[] = []
  for (const p of all) {
    const key = (p.title || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '').slice(0, 48)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(p)
  }
  merged.sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0))
  return merged.slice(0, limit)
}
