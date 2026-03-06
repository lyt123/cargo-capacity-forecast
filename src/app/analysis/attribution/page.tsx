'use client'
import { api } from '@/lib/config'
import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false })

interface Deviation {
  id: number; date: string; route_code: string; predicted_tons: number; actual_tons: number
  deviation_rate: number; ai_analysis: string; tags: string; confirmed: number; user_correction: string
}

const TAG_OPTIONS = ['宏观经济', '政策', '季节性', '电商', '竞争', '海运替代', '天气', '突发事件']

export default function AttributionPage() {
  const [data, setData] = useState<Deviation[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])
  const [editCorrection, setEditCorrection] = useState('')

  const load = () => fetch(api('/api/deviations?limit=200')).then(r => r.json()).then(setData)
  useEffect(() => { load() }, [])

  function startEdit(d: Deviation) {
    setEditId(d.id)
    try { setEditTags(JSON.parse(d.tags || '[]')) } catch { setEditTags([]) }
    setEditCorrection(d.user_correction || '')
  }

  async function saveEdit() {
    if (editId === null) return
    await fetch(api('/api/deviations'), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId, tags: JSON.stringify(editTags), user_correction: editCorrection }),
    })
    setEditId(null); load()
  }

  const tagStats = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(d => {
      try {
        const tags = JSON.parse(d.tags || '[]')
        tags.forEach((t: string) => { counts[t] = (counts[t] || 0) + 1 })
      } catch { /* skip */ }
    })
    return counts
  }, [data])

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const },
    legend: { bottom: 0, textStyle: { color: '#6B7280', fontSize: 11 } },
    series: [{
      type: 'pie' as const, radius: ['40%', '65%'],
      label: { show: false },
      data: Object.entries(tagStats).map(([name, value]) => ({ name, value })),
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      color: ['#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6', '#4B5563'],
    }],
  }), [tagStats])

  const patternTags = Object.entries(tagStats).filter(([, count]) => count >= 3)

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">归因知识库</h1>
        <p className="page-desc">历史偏差归因沉淀，形成预测经验知识</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card col-span-1">
          <h3 className="text-sm font-medium mb-2">归因标签分布</h3>
          {Object.keys(tagStats).length > 0 ? <Chart option={pieOption} height={240} /> : <p className="text-muted text-sm py-10 text-center">暂无数据</p>}
        </div>
        <div className="card col-span-2">
          <h3 className="text-sm font-medium mb-3">已形成模式的归因（≥3次）</h3>
          {patternTags.length > 0 ? (
            <div className="space-y-2">
              {patternTags.map(([tag, count]) => (
                <div key={tag} className="flex items-center justify-between p-3 bg-amber-50 rounded">
                  <span className="font-medium text-sm">{tag}</span>
                  <span className="text-xs text-amber-700">出现 {count} 次 — 已纳入预测模型</span>
                </div>
              ))}
            </div>
          ) : <p className="text-muted text-sm py-10 text-center">同类归因出现3次以上才会形成模式</p>}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-medium mb-3">偏差归因记录</h3>
        <table className="table-base">
          <thead><tr><th>日期</th><th>航线</th><th>预测值</th><th>实际值</th><th>偏差</th><th>归因标签</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {data.map(d => (
              <tr key={d.id}>
                <td>{d.date}</td>
                <td className="font-medium">{d.route_code}</td>
                <td>{d.predicted_tons}</td>
                <td>{d.actual_tons}</td>
                <td className={Math.abs(d.deviation_rate) > 10 ? 'text-red-600 font-medium' : ''}>{d.deviation_rate > 0 ? '+' : ''}{d.deviation_rate}%</td>
                <td>
                  {editId === d.id ? (
                    <div className="flex flex-wrap gap-1">
                      {TAG_OPTIONS.map(t => (
                        <button key={t} className={`text-xs px-2 py-0.5 rounded border ${editTags.includes(t) ? 'bg-neutral-900 text-white border-neutral-900' : 'border-border'}`}
                          onClick={() => setEditTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}>{t}</button>
                      ))}
                    </div>
                  ) : (
                    (() => { try { return JSON.parse(d.tags || '[]').map((t: string, i: number) => <span key={i} className="tag-gray mr-1">{t}</span>) } catch { return '-' } })()
                  )}
                </td>
                <td>{d.confirmed ? <span className="tag-green">已确认</span> : <span className="tag-yellow">待确认</span>}</td>
                <td>
                  {editId === d.id ? (
                    <div className="flex gap-2">
                      <button className="text-xs text-emerald-600 hover:underline" onClick={saveEdit}>保存</button>
                      <button className="text-xs text-muted hover:underline" onClick={() => setEditId(null)}>取消</button>
                    </div>
                  ) : (
                    <button className="text-xs text-neutral-600 hover:underline" onClick={() => startEdit(d)}>修正</button>
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-8">暂无归因记录</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
