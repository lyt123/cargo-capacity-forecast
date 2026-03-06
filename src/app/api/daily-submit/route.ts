import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { analyzeDeviation } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { entries } = await req.json()
    // entries: [{ route_id, date, actual_tons, actual_pieces }]

    const db = getDb()
    const results: Record<string, unknown>[] = []

    for (const entry of entries) {
      db.prepare(`
        INSERT OR REPLACE INTO cargo_history (date, route_id, actual_tons, actual_pieces, load_rate)
        VALUES (?, ?, ?, ?, ?)
      `).run(entry.date, entry.route_id, entry.actual_tons, entry.actual_pieces || null, null)

      const prediction = db.prepare(`
        SELECT predicted_tons FROM predictions
        WHERE target_date = ? AND route_id = ? ORDER BY predict_date DESC LIMIT 1
      `).get(entry.date, entry.route_id) as { predicted_tons: number } | undefined

      if (!prediction) {
        results.push({
          route_id: entry.route_id,
          date: entry.date,
          actual_tons: entry.actual_tons,
          predicted_tons: null,
          deviation: null,
          analysis: '无对应预测记录',
        })
        continue
      }

      const deviationRate = ((entry.actual_tons - prediction.predicted_tons) / prediction.predicted_tons * 100)

      const route = db.prepare('SELECT code FROM routes WHERE id = ?').get(entry.route_id) as { code: string }

      const recentData = db.prepare(`
        SELECT ch.date, ch.actual_tons FROM cargo_history ch
        WHERE ch.route_id = ? ORDER BY ch.date DESC LIMIT 14
      `).all(entry.route_id)

      const today = entry.date
      const events = db.prepare(`
        SELECT name, type, impact_percent FROM events
        WHERE start_date <= ? AND end_date >= ? AND (affected_routes LIKE ? OR affected_routes IS NULL)
      `).all(today, today, `%${route.code}%`)

      const signals = db.prepare(`
        SELECT es.category, ex.summary FROM external_signals ex
        JOIN external_sources es ON ex.source_id = es.id
        WHERE ex.date >= date(?, '-7 days') ORDER BY ex.date DESC LIMIT 10
      `).all(today)

      let analysis = ''
      let tags: string[] = []

      if (Math.abs(deviationRate) >= 5) {
        try {
          const aiResult = await analyzeDeviation({
            date: entry.date,
            route: route.code,
            predicted: prediction.predicted_tons,
            actual: entry.actual_tons,
            recentData: JSON.stringify(recentData),
            events: JSON.stringify(events),
            signals: JSON.stringify(signals),
          })
          const parsed = JSON.parse(aiResult.match(/\{[\s\S]*\}/)?.[0] || '{}')
          analysis = parsed.analysis || aiResult
          tags = parsed.tags || []
        } catch {
          analysis = '归因分析调用失败'
        }
      } else {
        analysis = '偏差在合理范围内（<5%）'
      }

      db.prepare(`
        INSERT INTO deviations (date, route_id, predicted_tons, actual_tons, deviation_rate, ai_analysis, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(entry.date, entry.route_id, prediction.predicted_tons, entry.actual_tons,
        Math.round(deviationRate * 10) / 10, analysis, JSON.stringify(tags))

      results.push({
        route_id: entry.route_id,
        date: entry.date,
        actual_tons: entry.actual_tons,
        predicted_tons: prediction.predicted_tons,
        deviation_rate: Math.round(deviationRate * 10) / 10,
        analysis,
        tags,
      })
    }

    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
