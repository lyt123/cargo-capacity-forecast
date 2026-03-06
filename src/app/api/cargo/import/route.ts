import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: '请上传文件' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    const db = getDb()
    const routes = db.prepare('SELECT id, code FROM routes').all() as { id: number; code: string }[]
    const routeMap = new Map(routes.map(r => [r.code.toUpperCase(), r.id]))

    const insert = db.prepare(`
      INSERT OR REPLACE INTO cargo_history (date, route_id, actual_tons, actual_pieces, load_rate)
      VALUES (?, ?, ?, ?, ?)
    `)

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    const tx = db.transaction(() => {
      for (const row of rows) {
        const date = parseDate(row['日期'] || row['date'] || row['Date'])
        const routeCode = String(row['航线'] || row['route'] || row['Route'] || '').toUpperCase()
        const tons = Number(row['货量(吨)'] || row['actual_tons'] || row['tons'] || 0)
        const pieces = Number(row['件数'] || row['actual_pieces'] || row['pieces'] || 0)
        const loadRate = Number(row['装载率'] || row['load_rate'] || 0)

        if (!date) { skipped++; errors.push(`跳过：日期无效 - ${JSON.stringify(row)}`); continue }

        let routeId = routeMap.get(routeCode)
        if (!routeId) {
          const result = db.prepare('INSERT OR IGNORE INTO routes (code, name) VALUES (?, ?)').run(routeCode, routeCode)
          if (result.lastInsertRowid) {
            routeId = Number(result.lastInsertRowid)
            routeMap.set(routeCode, routeId)
          } else {
            const r = db.prepare('SELECT id FROM routes WHERE code = ?').get(routeCode) as { id: number }
            routeId = r.id
            routeMap.set(routeCode, routeId)
          }
        }

        insert.run(date, routeId, tons || null, pieces || null, loadRate || null)
        imported++
      }
    })

    tx()

    return NextResponse.json({ imported, skipped, total: rows.length, errors: errors.slice(0, 10) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

function parseDate(val: unknown): string | null {
  if (!val) return null
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(val).trim()
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}
