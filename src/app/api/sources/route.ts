import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const sources = db.prepare('SELECT * FROM external_sources ORDER BY category').all()
  return NextResponse.json(sources)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO external_sources (name, url, category, description, enabled)
    VALUES (?, ?, ?, ?, ?)
  `).run(body.name, body.url, body.category, body.description, body.enabled ?? 1)
  return NextResponse.json({ id: result.lastInsertRowid })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const db = getDb()
  db.prepare(`
    UPDATE external_sources SET name = ?, url = ?, category = ?, description = ?, enabled = ? WHERE id = ?
  `).run(body.name, body.url, body.category, body.description, body.enabled, body.id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const db = getDb()
  db.prepare('DELETE FROM external_sources WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
