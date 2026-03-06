'use client'
import { useEffect, useState } from 'react'

interface Source { id: number; name: string; url: string; category: string; enabled: number; description: string }

const CATEGORIES = ['宏观经济', '海运运价', '汇率', '天气', '航空通告', '贸易政策', '电商动态', '其他']

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState<number | null>(null)

  const load = () => fetch('/api/sources').then(r => r.json()).then(setSources)
  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, url: form.url, category: form.category, description: form.description, enabled: 1 }),
    })
    setShowForm(false); setForm({}); setLoading(false); load()
  }

  async function toggleEnabled(s: Source) {
    await fetch('/api/sources', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...s, enabled: s.enabled ? 0 : 1 }),
    })
    load()
  }

  async function fetchSignal(sourceId: number) {
    setFetching(sourceId)
    try {
      const res = await fetch('/api/signals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId }),
      })
      const data = await res.json()
      if (data.error) alert(`抓取失败：${data.error}`)
      else alert(`抓取成功：${data.summary}`)
    } catch { alert('抓取请求失败') }
    setFetching(null)
  }

  async function handleDelete(id: number) {
    if (!confirm('确认删除？')) return
    await fetch(`/api/sources?id=${id}`, { method: 'DELETE' }); load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">外部数据源管理</h1>
          <p className="page-desc">配置外部情报抓取源，预测时自动拉取最新信息</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setForm({}) }}>+ 添加数据源</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div><label className="label">名称</label><input className="input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">类别</label>
              <select className="select" required value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">选择类别</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">URL</label><input className="input" required value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
            <div><label className="label">说明</label><input className="input" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? '保存中...' : '保存'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table-base">
          <thead><tr><th>名称</th><th>类别</th><th>URL</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td><span className="tag-gray">{s.category}</span></td>
                <td className="text-xs text-muted max-w-[200px] truncate">{s.url}</td>
                <td>
                  <button onClick={() => toggleEnabled(s)} className={`text-xs font-medium ${s.enabled ? 'text-emerald-600' : 'text-neutral-400'}`}>
                    {s.enabled ? '● 已启用' : '○ 已禁用'}
                  </button>
                </td>
                <td className="flex gap-3">
                  <button className="text-neutral-600 text-xs hover:underline" disabled={fetching === s.id}
                    onClick={() => fetchSignal(s.id)}>
                    {fetching === s.id ? '抓取中...' : '立即抓取'}
                  </button>
                  <button className="text-red-500 text-xs hover:underline" onClick={() => handleDelete(s.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
