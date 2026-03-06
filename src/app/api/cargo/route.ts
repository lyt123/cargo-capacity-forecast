import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const routeId = searchParams.get('route_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const limit = searchParams.get('limit') || '500'
  const offset = searchParams.get('offset') || '0'

  const db = getDb()
  let sql = `SELECT ch.*, r.code as route_code, r.name as route_name
             FROM cargo_history ch JOIN routes r ON ch.route_id = r.id WHERE 1=1`
  const params: unknown[] = []

  if (routeId) { sql += ' AND ch.route_id = ?'; params.push(routeId) }
  if (startDate) { sql += ' AND ch.date >= ?'; params.push(startDate) }
  if (endDate) { sql += ' AND ch.date <= ?'; params.push(endDate) }

  const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM')
  const total = (db.prepare(countSql).get(...params) as { total: number }).total

  sql += ` ORDER BY ch.date DESC LIMIT ? OFFSET ?`
  params.push(Number(limit), Number(offset))

  const data = db.prepare(sql).all(...params)
  return NextResponse.json({ data, total })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = getDb()

  if (Array.isArray(body)) {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO cargo_history (date, route_id, actual_tons, actual_pieces, load_rate)
      VALUES (?, ?, ?, ?, ?)
    `)
    const tx = db.transaction((rows: typeof body) => {
      for (const r of rows) {
        insert.run(r.date, r.route_id, r.actual_tons, r.actual_pieces, r.load_rate)
      }
    })
    tx(body)
    return NextResponse.json({ inserted: body.length })
  }

  const result = db.prepare(`
    INSERT OR REPLACE INTO cargo_history (date, route_id, actual_tons, actual_pieces, load_rate)
    VALUES (?, ?, ?, ?, ?)
  `).run(body.date, body.route_id, body.actual_tons, body.actual_pieces, body.load_rate)
  return NextResponse.json({ id: result.lastInsertRowid })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const db = getDb()
  db.prepare('DELETE FROM cargo_history WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
