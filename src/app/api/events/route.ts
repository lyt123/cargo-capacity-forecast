import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const events = db.prepare('SELECT * FROM events ORDER BY start_date DESC').all()
  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO events (name, type, affected_routes, impact_percent, start_date, end_date, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(body.name, body.type, body.affected_routes, body.impact_percent, body.start_date, body.end_date, body.description)
  return NextResponse.json({ id: result.lastInsertRowid })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const db = getDb()
  db.prepare(`
    UPDATE events SET name = ?, type = ?, affected_routes = ?, impact_percent = ?,
    start_date = ?, end_date = ?, description = ? WHERE id = ?
  `).run(body.name, body.type, body.affected_routes, body.impact_percent, body.start_date, body.end_date, body.description, body.id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const db = getDb()
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
