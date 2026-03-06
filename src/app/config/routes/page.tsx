'use client'
import { useEffect, useState } from 'react'

interface RouteRow {
  id: number; code: string; name: string
  fleet_id?: number; aircraft_type?: string; schedule?: string
  capacity_tons?: number; capacity_pieces?: number; quarter?: string; flights_per_week?: number
}

export default function RoutesConfig() {
  const [data, setData] = useState<RouteRow[]>([])
  const [showForm, setShowForm] = useState<'route' | 'fleet' | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const load = () => fetch('/api/routes').then(r => r.json()).then(setData)
  useEffect(() => { load() }, [])

  const routes = Array.from(new Map(data.map(d => [d.id, { id: d.id, code: d.code, name: d.name }])).values())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    if (showForm === 'route') {
      await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'route', code: form.code, name: form.name }),
      })
    } else {
      await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fleet', route_id: Number(form.route_id), aircraft_type: form.aircraft_type,
          schedule: form.schedule, capacity_tons: Number(form.capacity_tons),
          capacity_pieces: Number(form.capacity_pieces), quarter: form.quarter,
          flights_per_week: Number(form.flights_per_week),
        }),
      })
    }
    setShowForm(null); setForm({}); setLoading(false); load()
  }

  async function handleDelete(id: number, type: string) {
    if (!confirm('确认删除？')) return
    await fetch(`/api/routes?id=${id}&type=${type}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">航线与运力配置</h1>
          <p className="page-desc">管理航线信息和每条航线的运力基准</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => { setShowForm('route'); setForm({}) }}>+ 添加航线</button>
          <button className="btn-primary" onClick={() => { setShowForm('fleet'); setForm({}) }}>+ 添加运力配置</button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-medium mb-4">{showForm === 'route' ? '新增航线' : '新增运力配置'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            {showForm === 'route' ? (<>
              <div><label className="label">航线代码</label><input className="input" required value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="如 US" /></div>
              <div><label className="label">航线名称</label><input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如 美线" /></div>
            </>) : (<>
              <div><label className="label">航线</label>
                <select className="select" required value={form.route_id || ''} onChange={e => setForm({ ...form, route_id: e.target.value })}>
                  <option value="">选择航线</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
                </select>
              </div>
              <div><label className="label">机型</label><input className="input" required value={form.aircraft_type || ''} onChange={e => setForm({ ...form, aircraft_type: e.target.value })} placeholder="如 B777F" /></div>
              <div><label className="label">航班排期</label><input className="input" required value={form.schedule || ''} onChange={e => setForm({ ...form, schedule: e.target.value })} placeholder="如 周一/三/五/日" /></div>
              <div><label className="label">单班运力(吨)</label><input className="input" type="number" required value={form.capacity_tons || ''} onChange={e => setForm({ ...form, capacity_tons: e.target.value })} /></div>
              <div><label className="label">单班运力(件)</label><input className="input" type="number" required value={form.capacity_pieces || ''} onChange={e => setForm({ ...form, capacity_pieces: e.target.value })} /></div>
              <div><label className="label">周航班数</label><input className="input" type="number" required value={form.flights_per_week || ''} onChange={e => setForm({ ...form, flights_per_week: e.target.value })} /></div>
              <div><label className="label">生效季度</label><input className="input" required value={form.quarter || ''} onChange={e => setForm({ ...form, quarter: e.target.value })} placeholder="如 2026Q1" /></div>
            </>)}
            <div className="col-span-3 flex gap-2">
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? '保存中...' : '保存'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(null)}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table-base">
          <thead><tr>
            <th>航线</th><th>机型</th><th>航班排期</th><th>单班运力(吨)</th><th>周航班数</th><th>周运力(吨)</th><th>季度</th><th>操作</th>
          </tr></thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                <td className="font-medium">{row.code} - {row.name}</td>
                <td>{row.aircraft_type || '-'}</td>
                <td>{row.schedule || '-'}</td>
                <td>{row.capacity_tons || '-'}</td>
                <td>{row.flights_per_week || '-'}</td>
                <td className="font-medium">{row.capacity_tons && row.flights_per_week ? row.capacity_tons * row.flights_per_week : '-'}</td>
                <td>{row.quarter || '-'}</td>
                <td>
                  {row.fleet_id && <button className="text-red-500 text-xs hover:underline" onClick={() => handleDelete(row.fleet_id!, 'fleet')}>删除配置</button>}
                  {!row.fleet_id && <button className="text-red-500 text-xs hover:underline" onClick={() => handleDelete(row.id, 'route')}>删除航线</button>}
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-8">暂无数据</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
