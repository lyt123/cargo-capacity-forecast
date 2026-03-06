import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const routes = db.prepare('SELECT * FROM routes ORDER BY code').all() as { id: number; code: string; name: string }[]

  const loadRates = routes.map(r => {
    const latest = db.prepare(`
      SELECT actual_tons, load_rate, date FROM cargo_history
      WHERE route_id = ? ORDER BY date DESC LIMIT 1
    `).get(r.id) as { actual_tons: number; load_rate: number; date: string } | undefined

    const fleet = db.prepare(`
      SELECT capacity_tons, flights_per_week FROM fleet_config WHERE route_id = ? LIMIT 1
    `).get(r.id) as { capacity_tons: number; flights_per_week: number } | undefined

    const weekCapacity = fleet ? fleet.capacity_tons * fleet.flights_per_week : 0
    const dailyCapacity = weekCapacity / 7

    const loadRate = latest?.load_rate || (dailyCapacity > 0 && latest?.actual_tons
      ? Math.round(latest.actual_tons / dailyCapacity * 1000) / 10
      : 0)

    return {
      route: r.code,
      routeName: r.name,
      loadRate,
      latestTons: latest?.actual_tons || 0,
      dailyCapacity,
      date: latest?.date || '-',
    }
  })

  const totalRecords = (db.prepare('SELECT COUNT(*) as c FROM cargo_history').get() as { c: number }).c
  const totalPredictions = (db.prepare('SELECT COUNT(*) as c FROM predictions').get() as { c: number }).c
  const totalDeviations = (db.prepare('SELECT COUNT(*) as c FROM deviations').get() as { c: number }).c

  const avgDeviation = db.prepare(`
    SELECT AVG(ABS(deviation_rate)) as avg FROM deviations WHERE date >= date('now', '-30 days')
  `).get() as { avg: number | null }

  const recentDeviations = db.prepare(`
    SELECT d.date, r.code, d.deviation_rate, d.tags
    FROM deviations d JOIN routes r ON d.route_id = r.id
    ORDER BY d.date DESC LIMIT 5
  `).all()

  return NextResponse.json({
    loadRates,
    stats: {
      totalRecords,
      totalPredictions,
      totalDeviations,
      avgDeviation: avgDeviation.avg ? Math.round(avgDeviation.avg * 10) / 10 : 0,
    },
    recentDeviations,
  })
}
