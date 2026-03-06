import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { generateDecisions } from '@/lib/ai'

export async function GET() {
  const db = getDb()
  const data = db.prepare(`
    SELECT d.*, r.code as route_code FROM decisions d
    LEFT JOIN routes r ON d.route_id = r.id
    ORDER BY d.date DESC LIMIT 50
  `).all()
  return NextResponse.json(data)
}

export async function POST() {
  try {
    const db = getDb()

    const loadRates = db.prepare(`
      SELECT r.code, ch.date, ch.actual_tons, ch.load_rate,
             fc.capacity_tons, fc.flights_per_week
      FROM cargo_history ch
      JOIN routes r ON ch.route_id = r.id
      LEFT JOIN fleet_config fc ON fc.route_id = r.id
      ORDER BY ch.date DESC LIMIT 30
    `).all()

    const deviations = db.prepare(`
      SELECT r.code, d.date, d.deviation_rate, d.tags
      FROM deviations d JOIN routes r ON d.route_id = r.id
      ORDER BY d.date DESC LIMIT 20
    `).all()

    const trends = db.prepare(`
      SELECT r.code, ch.date, ch.actual_tons
      FROM cargo_history ch JOIN routes r ON ch.route_id = r.id
      ORDER BY ch.date DESC LIMIT 60
    `).all()

    const result = await generateDecisions({
      loadRates: JSON.stringify(loadRates),
      deviations: JSON.stringify(deviations),
      trends: JSON.stringify(trends),
    })

    let parsed
    try {
      parsed = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}')
    } catch { parsed = { raw: result } }

    if (parsed.decisions && Array.isArray(parsed.decisions)) {
      const routes = db.prepare('SELECT id, code FROM routes').all() as { id: number; code: string }[]
      const routeMap = new Map(routes.map(r => [r.code, r.id]))
      const today = new Date().toISOString().slice(0, 10)
      const insert = db.prepare('INSERT INTO decisions (date, route_id, content, type) VALUES (?, ?, ?, ?)')
      for (const d of parsed.decisions) {
        const routeId = routeMap.get(d.route) || null
        insert.run(today, routeId, d.suggestion, d.type)
      }
    }

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const db = getDb()
  db.prepare('UPDATE decisions SET status = ? WHERE id = ?').run(body.status, body.id)
  return NextResponse.json({ ok: true })
}
