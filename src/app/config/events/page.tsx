'use client'
import { useEffect, useState } from 'react'

const EVENT_TYPES = ['节假日', '电商大促', '政策变动', '行业展会', '天气事件', '突发事件', '其他']

interface Event { id: number; name: string; type: string; affected_routes: string; impact_percent: number; start_date: string; end_date: string; description: string }

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [editId, setEditId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => fetch('/api/events').then(r => r.json()).then(setEvents)
  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      name: form.name, type: form.type, affected_routes: form.affected_routes,
      impact_percent: Number(form.impact_percent) || 0,
      start_date: form.start_date, end_date: form.end_date, description: form.description,
    }
    if (editId) {
      await fetch('/api/events', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, id: editId }) })
    } else {
      await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setShowForm(false); setForm({}); setEditId(null); setLoading(false); load()
  }

  function startEdit(ev: Event) {
    setForm({ name: ev.name, type: ev.type, affected_routes: ev.affected_routes || '', impact_percent: String(ev.impact_percent), start_date: ev.start_date, end_date: ev.end_date, description: ev.description || '' })
    setEditId(ev.id); setShowForm(true)
  }

  async function handleDelete(id: number) {
    if (!confirm('确认删除？')) return
    await fetch(`/api/events?id=${id}`, { method: 'DELETE' }); load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">事件管理</h1>
          <p className="page-desc">管理节假日、大促、政策等影响货量的事件</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setForm({}); setEditId(null) }}>+ 添加事件</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-sm font-medium mb-4">{editId ? '编辑事件' : '新增事件'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-4">
            <div><label className="label">事件名称</label><input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">类型</label>
              <select className="select" required value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="">选择类型</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">影响航线</label><input className="input" value={form.affected_routes || ''} onChange={e => setForm({ ...form, affected_routes: e.target.value })} placeholder="如 US,EU（留空=全部）" /></div>
            <div><label className="label">预估影响(%)</label><input className="input" type="number" value={form.impact_percent || ''} onChange={e => setForm({ ...form, impact_percent: e.target.value })} placeholder="如 15 表示+15%" /></div>
            <div><label className="label">开始日期</label><input className="input" type="date" required value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="label">结束日期</label><input className="input" type="date" required value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div className="col-span-3"><label className="label">描述</label><textarea className="input" rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="col-span-3 flex gap-2">
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? '保存中...' : '保存'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table-base">
          <thead><tr><th>事件</th><th>类型</th><th>影响航线</th><th>影响幅度</th><th>起止日期</th><th>操作</th></tr></thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id}>
                <td className="font-medium">{ev.name}</td>
                <td><span className="tag-gray">{ev.type}</span></td>
                <td>{ev.affected_routes || '全部'}</td>
                <td className={ev.impact_percent > 0 ? 'text-red-600' : ev.impact_percent < 0 ? 'text-emerald-600' : ''}>
                  {ev.impact_percent > 0 ? '+' : ''}{ev.impact_percent}%
                </td>
                <td className="text-xs text-muted">{ev.start_date} ~ {ev.end_date}</td>
                <td className="flex gap-3">
                  <button className="text-neutral-500 text-xs hover:underline" onClick={() => startEdit(ev)}>编辑</button>
                  <button className="text-red-500 text-xs hover:underline" onClick={() => handleDelete(ev.id)}>删除</button>
                </td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-8">暂无事件</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
