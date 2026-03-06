import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { simulateWhatIf } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { assumption } = await req.json()
    const db = getDb()

    const currentData = db.prepare(`
      SELECT r.code, ch.date, ch.actual_tons, fc.capacity_tons, fc.flights_per_week
      FROM cargo_history ch
      JOIN routes r ON ch.route_id = r.id
      LEFT JOIN fleet_config fc ON fc.route_id = r.id
      ORDER BY ch.date DESC LIMIT 30
    `).all()

    const predictions = db.prepare(`
      SELECT r.code, p.target_date as date, p.predicted_tons
      FROM predictions p JOIN routes r ON p.route_id = r.id
      WHERE p.target_date >= date('now')
      ORDER BY p.target_date ASC LIMIT 30
    `).all()

    const result = await simulateWhatIf({
      currentData: JSON.stringify({ history: currentData, currentPredictions: predictions }),
      assumption,
    })

    let parsed
    try {
      parsed = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}')
    } catch { parsed = { raw: result } }

    db.prepare(`
      INSERT INTO simulations (assumption, original_prediction, simulated_prediction, comparison)
      VALUES (?, ?, ?, ?)
    `).run(assumption, JSON.stringify(parsed.original), JSON.stringify(parsed.simulated), parsed.analysis || '')

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  const db = getDb()
  const data = db.prepare('SELECT * FROM simulations ORDER BY created_at DESC LIMIT 20').all()
  return NextResponse.json(data)
}
