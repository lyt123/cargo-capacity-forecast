'use client'
import { api } from '@/lib/config'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false })

interface SimResult {
  original?: { date: string; route: string; tons: number }[]
  simulated?: { date: string; route: string; tons: number }[]
  analysis?: string
  raw?: string
}

interface HistorySim { id: number; assumption: string; comparison: string; created_at: string }

export default function SimulationPage() {
  const [assumption, setAssumption] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)
  const [history, setHistory] = useState<HistorySim[]>([])

  useEffect(() => {
    fetch(api('/api/simulate')).then(r => r.json()).then(setHistory)
  }, [])

  async function runSimulation() {
    if (!assumption.trim()) return
    setLoading(true)
    try {
      const res = await fetch(api('/api/simulate'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assumption }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setResult(data)
      fetch(api('/api/simulate')).then(r => r.json()).then(setHistory)
    } catch { alert('模拟失败') }
    setLoading(false)
  }

  const chartOption = result?.original && result?.simulated ? {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['原预测', '模拟预测'], textStyle: { color: '#6B7280' } },
    grid: { left: 60, right: 30, top: 40, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: Array.from(new Set([...(result.original?.map(d => d.date) || []), ...(result.simulated?.map(d => d.date) || [])])).sort(),
      axisLabel: { fontSize: 10, color: '#6B7280' },
    },
    yAxis: { type: 'value' as const, name: '吨', axisLabel: { color: '#6B7280' }, splitLine: { lineStyle: { color: '#F3F4F6' } } },
    series: [
      { name: '原预测', type: 'line' as const, data: result.original?.map(d => d.tons), lineStyle: { color: '#D1D5DB' }, itemStyle: { color: '#D1D5DB' } },
      { name: '模拟预测', type: 'line' as const, data: result.simulated?.map(d => d.tons), lineStyle: { color: '#111827', width: 2 }, itemStyle: { color: '#111827' } },
    ],
  } : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">What-if 模拟</h1>
        <p className="page-desc">输入假设条件，AI 重新计算预测结果</p>
      </div>

      <div className="card mb-6">
        <h3 className="text-sm font-medium mb-3">输入假设条件</h3>
        <div className="flex gap-3">
          <input className="input flex-1" placeholder="例：增加一班美线B777F航班 / 黑五提前一周开始 / 深圳未来一周暴雨"
            value={assumption} onChange={e => setAssumption(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSimulation()} />
          <button className="btn-primary whitespace-nowrap" onClick={runSimulation} disabled={loading}>
            {loading ? 'AI 模拟中...' : '运行模拟'}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {['增加一班美线B777F航班', '黑五提前一周', '海运运价上涨30%', '深圳台风预警'].map(s => (
            <button key={s} className="text-xs px-3 py-1 rounded-full border border-border hover:bg-neutral-50"
              onClick={() => setAssumption(s)}>{s}</button>
          ))}
        </div>
      </div>

      {result && (
        <>
          {chartOption && (
            <div className="card mb-6">
              <h3 className="text-sm font-medium mb-2">对比：原预测 vs 模拟预测</h3>
              <Chart option={chartOption} height={300} />
            </div>
          )}
          {result.analysis && (
            <div className="card mb-6">
              <h3 className="text-sm font-medium mb-2">模拟分析</h3>
              <p className="text-sm text-muted leading-relaxed">{result.analysis}</p>
            </div>
          )}
          {result.raw && (
            <div className="card mb-6">
              <h3 className="text-sm font-medium mb-2">AI 原始输出</h3>
              <pre className="text-xs text-muted whitespace-pre-wrap bg-neutral-50 p-3 rounded">{result.raw}</pre>
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium mb-3">历史模拟记录</h3>
          <table className="table-base">
            <thead><tr><th>假设条件</th><th>分析结论</th><th>时间</th></tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td className="font-medium">{h.assumption}</td>
                  <td className="text-sm text-muted max-w-md truncate">{h.comparison || '-'}</td>
                  <td className="text-xs text-muted">{h.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
