'use client'
import { useEffect, useState } from 'react'

interface Route { id: number; code: string; name: string }
interface DeviationResult {
  route_id: number; date: string; actual_tons: number; predicted_tons: number | null
  deviation_rate: number | null; analysis: string; tags: string[]
}

export default function DailySubmitPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [entries, setEntries] = useState<Record<number, { tons: string; pieces: string }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<DeviationResult[]>([])

  useEffect(() => {
    fetch('/api/routes').then(r => r.json()).then(data => {
      const unique = Array.from(new Map(data.map((d: Route) => [d.id, d])).values()) as Route[]
      setRoutes(unique)
      const init: typeof entries = {}
      unique.forEach(r => { init[r.id] = { tons: '', pieces: '' } })
      setEntries(init)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const items = routes
      .filter(r => entries[r.id]?.tons)
      .map(r => ({
        route_id: r.id, date,
        actual_tons: Number(entries[r.id].tons),
        actual_pieces: Number(entries[r.id].pieces) || null,
      }))

    if (items.length === 0) { alert('请至少填写一条航线数据'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/daily-submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: items }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setResults(data.results || [])
    } catch { alert('提交失败') }
    setSubmitting(false)
  }

  function getDeviationColor(rate: number | null) {
    if (rate === null) return ''
    if (Math.abs(rate) < 5) return 'text-emerald-600'
    if (Math.abs(rate) < 10) return 'text-amber-600'
    return 'text-red-600'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">每日数据提交</h1>
        <p className="page-desc">提交昨日实际货量，系统自动分析偏差归因</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div>
              <label className="label">数据日期</label>
              <input type="date" className="input w-44" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <table className="table-base">
            <thead><tr><th>航线</th><th>实际货量（吨）</th><th>件数</th></tr></thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td className="font-medium">{r.code} - {r.name}</td>
                  <td>
                    <input type="number" step="0.1" className="input w-36"
                      value={entries[r.id]?.tons || ''} placeholder="吨"
                      onChange={e => setEntries({ ...entries, [r.id]: { ...entries[r.id], tons: e.target.value } })} />
                  </td>
                  <td>
                    <input type="number" className="input w-36"
                      value={entries[r.id]?.pieces || ''} placeholder="件（选填）"
                      onChange={e => setEntries({ ...entries, [r.id]: { ...entries[r.id], pieces: e.target.value } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'AI 分析偏差中...' : '提交并分析偏差'}
            </button>
          </div>
        </div>
      </form>

      {results.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium mb-4">偏差分析结果</h3>
          <div className="space-y-4">
            {results.map((r, i) => {
              const route = routes.find(rt => rt.id === r.route_id)
              return (
                <div key={i} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{route?.code} - {route?.name}</span>
                    {r.deviation_rate !== null && (
                      <span className={`text-sm font-medium ${getDeviationColor(r.deviation_rate)}`}>
                        偏差 {r.deviation_rate > 0 ? '+' : ''}{r.deviation_rate}%
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div><span className="text-muted">实际值：</span>{r.actual_tons} 吨</div>
                    <div><span className="text-muted">预测值：</span>{r.predicted_tons ?? '无'} 吨</div>
                    <div><span className="text-muted">偏差率：</span>{r.deviation_rate !== null ? `${r.deviation_rate}%` : '-'}</div>
                  </div>
                  <div className="text-sm text-muted bg-neutral-50 rounded p-3">
                    <p className="font-medium text-neutral-700 mb-1">归因分析：</p>
                    <p>{r.analysis}</p>
                    {r.tags && r.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {r.tags.map((tag, j) => <span key={j} className="tag-gray">{tag}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
