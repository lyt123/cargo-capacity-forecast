import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const routeId = searchParams.get('route_id')
  const limit = searchParams.get('limit') || '100'

  const db = getDb()
  let sql = `SELECT d.*, r.code as route_code, r.name as route_name
             FROM deviations d JOIN routes r ON d.route_id = r.id WHERE 1=1`
  const params: unknown[] = []
  if (routeId) { sql += ' AND d.route_id = ?'; params.push(routeId) }
  sql += ' ORDER BY d.date DESC LIMIT ?'
  params.push(Number(limit))

  const data = db.prepare(sql).all(...params)
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const db = getDb()
  db.prepare(`
    UPDATE deviations SET tags = ?, user_correction = ?, confirmed = 1 WHERE id = ?
  `).run(body.tags, body.user_correction || null, body.id)
  return NextResponse.json({ ok: true })
}
