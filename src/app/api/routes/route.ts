import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const routes = db.prepare(`
    SELECT r.*, fc.aircraft_type, fc.schedule, fc.capacity_tons, fc.capacity_pieces,
           fc.quarter, fc.flights_per_week, fc.id as fleet_id
    FROM routes r LEFT JOIN fleet_config fc ON r.id = fc.route_id
    ORDER BY r.code
  `).all()
  return NextResponse.json(routes)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = getDb()

  if (body.type === 'route') {
    const result = db.prepare('INSERT INTO routes (code, name) VALUES (?, ?)').run(body.code, body.name)
    return NextResponse.json({ id: result.lastInsertRowid })
  }

  if (body.type === 'fleet') {
    const result = db.prepare(`
      INSERT INTO fleet_config (route_id, aircraft_type, schedule, capacity_tons, capacity_pieces, quarter, flights_per_week)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(body.route_id, body.aircraft_type, body.schedule, body.capacity_tons, body.capacity_pieces, body.quarter, body.flights_per_week)
    return NextResponse.json({ id: result.lastInsertRowid })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const db = getDb()

  if (body.type === 'route') {
    db.prepare('UPDATE routes SET code = ?, name = ? WHERE id = ?').run(body.code, body.name, body.id)
  } else if (body.type === 'fleet') {
    db.prepare(`
      UPDATE fleet_config SET aircraft_type = ?, schedule = ?, capacity_tons = ?, capacity_pieces = ?,
      quarter = ?, flights_per_week = ? WHERE id = ?
    `).run(body.aircraft_type, body.schedule, body.capacity_tons, body.capacity_pieces, body.quarter, body.flights_per_week, body.id)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type')
  const db = getDb()

  if (type === 'fleet') {
    db.prepare('DELETE FROM fleet_config WHERE id = ?').run(id)
  } else {
    db.prepare('DELETE FROM fleet_config WHERE route_id = ?').run(id)
    db.prepare('DELETE FROM routes WHERE id = ?').run(id)
  }

  return NextResponse.json({ ok: true })
}
