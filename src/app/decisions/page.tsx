'use client'
import { api } from '@/lib/config'
import { useEffect, useState } from 'react'

interface Decision {
  id: number; date: string; route_code: string; content: string; type: string; status: string
}

export default function DecisionsPage() {
  const [data, setData] = useState<Decision[]>([])
  const [generating, setGenerating] = useState(false)

  const load = () => fetch(api('/api/decisions')).then(r => r.json()).then(setData)
  useEffect(() => { load() }, [])

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch(api('/api/decisions'), { method: 'POST' })
      const result = await res.json()
      if (result.error) { alert(result.error); return }
      load()
    } catch { alert('生成失败') }
    setGenerating(false)
  }

  async function updateStatus(id: number, status: string) {
    await fetch(api('/api/decisions'), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  function getTypeLabel(type: string) {
    return type === 'surplus' ? { label: '运力过剩', cls: 'tag-yellow' }
      : type === 'shortage' ? { label: '运力不足', cls: 'tag-red' }
      : { label: type, cls: 'tag-gray' }
  }

  function getStatusLabel(status: string) {
    return status === 'adopted' ? { label: '已采纳', cls: 'tag-green' }
      : status === 'ignored' ? { label: '已忽略', cls: 'tag-gray' }
      : { label: '待处理', cls: 'tag-yellow' }
  }

  const pending = data.filter(d => d.status === 'pending')
  const handled = data.filter(d => d.status !== 'pending')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">决策建议</h1>
          <p className="page-desc">基于装载率与偏差分析，AI 生成运营建议</p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={generating}>
          {generating ? 'AI 生成中...' : '生成最新建议'}
        </button>
      </div>

      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">待处理建议</h3>
          <div className="space-y-3">
            {pending.map(d => {
              const typeInfo = getTypeLabel(d.type)
              return (
                <div key={d.id} className="card flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={typeInfo.cls}>{typeInfo.label}</span>
                      {d.route_code && <span className="text-xs text-muted">{d.route_code}</span>}
                      <span className="text-xs text-muted">{d.date}</span>
                    </div>
                    <p className="text-sm">{d.content}</p>
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button className="btn-primary text-xs !py-1.5" onClick={() => updateStatus(d.id, 'adopted')}>采纳</button>
                    <button className="btn-secondary text-xs !py-1.5" onClick={() => updateStatus(d.id, 'ignored')}>忽略</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-medium mb-3">历史建议</h3>
        <table className="table-base">
          <thead><tr><th>日期</th><th>航线</th><th>类型</th><th>建议内容</th><th>状态</th></tr></thead>
          <tbody>
            {(handled.length > 0 ? handled : data).map(d => {
              const typeInfo = getTypeLabel(d.type)
              const statusInfo = getStatusLabel(d.status)
              return (
                <tr key={d.id}>
                  <td>{d.date}</td>
                  <td className="font-medium">{d.route_code || '-'}</td>
                  <td><span className={typeInfo.cls}>{typeInfo.label}</span></td>
                  <td className="max-w-md text-sm">{d.content}</td>
                  <td><span className={statusInfo.cls}>{statusInfo.label}</span></td>
                </tr>
              )
            })}
            {data.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-8">暂无决策建议</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
