import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { predictCargo } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { period = '7d' } = await req.json()
    const db = getDb()

    const history = db.prepare(`
      SELECT ch.date, r.code as route, ch.actual_tons
      FROM cargo_history ch JOIN routes r ON ch.route_id = r.id
      ORDER BY ch.date DESC LIMIT 90
    `).all()

    const fleetConfig = db.prepare(`
      SELECT r.code, fc.aircraft_type, fc.capacity_tons, fc.flights_per_week, fc.quarter, fc.schedule
      FROM fleet_config fc JOIN routes r ON fc.route_id = r.id
    `).all()

    const today = new Date().toISOString().slice(0, 10)
    const events = db.prepare(`
      SELECT name, type, affected_routes, impact_percent, start_date, end_date
      FROM events WHERE end_date >= ? ORDER BY start_date
    `).all(today)

    const signals = db.prepare(`
      SELECT es.category, ex.summary, ex.value, ex.date
      FROM external_signals ex JOIN external_sources es ON ex.source_id = es.id
      ORDER BY ex.date DESC LIMIT 20
    `).all()

    const deviations = db.prepare(`
      SELECT d.date, r.code as route, d.deviation_rate, d.tags, d.ai_analysis
      FROM deviations d JOIN routes r ON d.route_id = r.id
      ORDER BY d.date DESC LIMIT 30
    `).all()

    const result = await predictCargo({
      historyData: JSON.stringify(history),
      routeConfig: JSON.stringify(fleetConfig),
      events: JSON.stringify(events),
      signals: JSON.stringify(signals),
      deviations: JSON.stringify(deviations),
      period,
    })

    let parsed
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result }
    } catch {
      parsed = { raw: result }
    }

    if (parsed.predictions && Array.isArray(parsed.predictions)) {
      const routes = db.prepare('SELECT id, code FROM routes').all() as { id: number; code: string }[]
      const routeMap = new Map(routes.map(r => [r.code, r.id]))
      const insert = db.prepare(`
        INSERT INTO predictions (predict_date, target_date, route_id, predicted_tons, confidence_low, confidence_high, factors)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const tx = db.transaction(() => {
        for (const p of parsed.predictions) {
          const routeId = routeMap.get(p.route)
          if (!routeId) continue
          insert.run(today, p.date, routeId, p.predicted_tons, p.confidence_low, p.confidence_high, parsed.factors || '')
        }
      })
      tx()
    }

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const routeId = searchParams.get('route_id')
  const db = getDb()

  let sql = `SELECT p.*, r.code as route_code FROM predictions p JOIN routes r ON p.route_id = r.id WHERE 1=1`
  const params: unknown[] = []
  if (routeId) { sql += ' AND p.route_id = ?'; params.push(routeId) }
  sql += ' ORDER BY p.target_date ASC'

  const data = db.prepare(sql).all(...params)
  return NextResponse.json(data)
}
