import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { summarizeSignal } from '@/lib/ai'

export async function GET() {
  const db = getDb()
  const data = db.prepare(`
    SELECT ex.*, es.name as source_name, es.url as source_url
    FROM external_signals ex JOIN external_sources es ON ex.source_id = es.id
    ORDER BY ex.date DESC LIMIT 50
  `).all()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const { source_id } = await req.json()
    const db = getDb()

    const source = db.prepare('SELECT * FROM external_sources WHERE id = ? AND enabled = 1').get(source_id) as {
      id: number; name: string; url: string; category: string
    } | undefined

    if (!source) return NextResponse.json({ error: '数据源不存在或已禁用' }, { status: 400 })

    let rawText = ''
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      })
      rawText = await res.text()
    } catch {
      return NextResponse.json({ error: `抓取失败：${source.url}` }, { status: 500 })
    }

    const aiResult = await summarizeSignal(rawText, source.category)
    let parsed
    try {
      parsed = JSON.parse(aiResult.match(/\{[\s\S]*\}/)?.[0] || '{}')
    } catch { parsed = { summary: aiResult, value: null } }

    const today = new Date().toISOString().slice(0, 10)
    db.prepare(`
      INSERT INTO external_signals (date, source_id, category, summary, value, raw_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(today, source.id, source.category, parsed.summary, parsed.value, rawText.slice(0, 2000))

    return NextResponse.json({ summary: parsed.summary, value: parsed.value })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
