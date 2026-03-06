'use client'
import { api } from '@/lib/config'
import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false })

interface BacktestRow {
  date: string; route_code: string; predicted_tons: number; actual_tons: number; deviation_rate: number
}

export default function BacktestPage() {
  const [data, setData] = useState<BacktestRow[]>([])
  const [routes, setRoutes] = useState<{ id: number; code: string; name: string }[]>([])
  const [selectedRoute, setSelectedRoute] = useState('all')

  useEffect(() => {
    fetch(api('/api/deviations?limit=200')).then(r => r.json()).then(setData)
    fetch(api('/api/routes')).then(r => r.json()).then(d => {
      const unique = Array.from(new Map(d.map((x: { id: number }) => [x.id, x])).values()) as typeof routes
      setRoutes(unique)
    })
  }, [])

  const filtered = selectedRoute === 'all' ? data : data.filter(d => d.route_code === selectedRoute)

  const mape = useMemo(() => {
    if (filtered.length === 0) return 0
    const sum = filtered.reduce((acc, d) => acc + Math.abs(d.deviation_rate), 0)
    return Math.round(sum / filtered.length * 10) / 10
  }, [filtered])

  const accuracy = Math.max(0, 100 - mape)

  const trendOption = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))
    const dates = sorted.map(d => d.date)
    const predicted = sorted.map(d => d.predicted_tons)
    const actual = sorted.map(d => d.actual_tons)

    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['预测值', '实际值'], textStyle: { color: '#6B7280' } },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category' as const, data: dates, axisLabel: { fontSize: 10, color: '#6B7280' } },
      yAxis: { type: 'value' as const, name: '吨', axisLabel: { color: '#6B7280' }, splitLine: { lineStyle: { color: '#F3F4F6' } } },
      series: [
        { name: '预测值', type: 'line' as const, data: predicted, lineStyle: { color: '#6B7280', type: 'dashed' as const }, itemStyle: { color: '#6B7280' }, symbol: 'circle', symbolSize: 4 },
        { name: '实际值', type: 'line' as const, data: actual, lineStyle: { color: '#111827' }, itemStyle: { color: '#111827' }, symbol: 'circle', symbolSize: 4 },
      ],
    }
  }, [filtered])

  const deviationOption = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))
    return {
      tooltip: { trigger: 'axis' as const },
      grid: { left: 60, right: 30, top: 20, bottom: 30 },
      xAxis: { type: 'category' as const, data: sorted.map(d => d.date), axisLabel: { fontSize: 10, color: '#6B7280' } },
      yAxis: { type: 'value' as const, name: '偏差%', axisLabel: { color: '#6B7280' }, splitLine: { lineStyle: { color: '#F3F4F6' } } },
      series: [{
        type: 'bar' as const, data: sorted.map(d => ({
          value: d.deviation_rate,
          itemStyle: { color: Math.abs(d.deviation_rate) > 10 ? '#EF4444' : Math.abs(d.deviation_rate) > 5 ? '#F59E0B' : '#D1D5DB' },
        })),
      }],
    }
  }, [filtered])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">预测回测</h1>
          <p className="page-desc">验证预测精度，对比预测值与实际值</p>
        </div>
        <select className="select w-36" value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}>
          <option value="all">全部航线</option>
          {routes.map(r => <option key={r.id} value={r.code}>{r.code} - {r.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-xs text-muted mb-1">预测准确率</div>
          <div className="text-3xl font-semibold">{accuracy.toFixed(1)}%</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-muted mb-1">平均偏差 (MAPE)</div>
          <div className="text-3xl font-semibold">{mape}%</div>
        </div>
        <div className="card text-center">
          <div className="text-xs text-muted mb-1">回测样本数</div>
          <div className="text-3xl font-semibold">{filtered.length}</div>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-sm font-medium mb-2">预测值 vs 实际值</h3>
        {filtered.length > 0 ? <Chart option={trendOption} height={300} /> : <p className="text-muted text-sm py-10 text-center">暂无回测数据</p>}
      </div>

      <div className="card">
        <h3 className="text-sm font-medium mb-2">偏差率分布</h3>
        {filtered.length > 0 ? <Chart option={deviationOption} height={250} /> : <p className="text-muted text-sm py-10 text-center">暂无回测数据</p>}
      </div>
    </div>
  )
}
