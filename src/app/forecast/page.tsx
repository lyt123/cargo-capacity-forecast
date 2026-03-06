'use client'
import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false })

interface Route { id: number; code: string; name: string; capacity_tons?: number; flights_per_week?: number }
interface DataPoint { date: string; route_code?: string; route_id?: number; actual_tons?: number; predicted_tons?: number; confidence_low?: number; confidence_high?: number; target_date?: string }

export default function ForecastPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedRoute, setSelectedRoute] = useState<string>('all')
  const [history, setHistory] = useState<DataPoint[]>([])
  const [predictions, setPredictions] = useState<DataPoint[]>([])
  const [events, setEvents] = useState<{ name: string; start_date: string; end_date: string }[]>([])
  const [predicting, setPredicting] = useState(false)
  const [period, setPeriod] = useState<'7d' | '30d'>('7d')
  const [factors, setFactors] = useState('')

  useEffect(() => {
    fetch('/api/routes').then(r => r.json()).then(data => {
      const unique = Array.from(new Map(data.map((d: Route) => [d.id, d])).values()) as Route[]
      setRoutes(unique)
    })
    fetch('/api/events').then(r => r.json()).then(setEvents)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({ limit: '500' })
    if (selectedRoute !== 'all') params.set('route_id', selectedRoute)
    fetch(`/api/cargo?${params}`).then(r => r.json()).then(res => setHistory(res.data))

    const pParams = new URLSearchParams()
    if (selectedRoute !== 'all') pParams.set('route_id', selectedRoute)
    fetch(`/api/predict?${pParams}`).then(r => r.json()).then(setPredictions)
  }, [selectedRoute])

  async function runPredict() {
    setPredicting(true)
    try {
      const res = await fetch('/api/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setFactors(data.factors || '')
      const pParams = new URLSearchParams()
      if (selectedRoute !== 'all') pParams.set('route_id', selectedRoute)
      const pRes = await fetch(`/api/predict?${pParams}`)
      setPredictions(await pRes.json())
    } catch { alert('预测失败') }
    setPredicting(false)
  }

  const capacityPerDay = useMemo(() => {
    if (selectedRoute === 'all') {
      return routes.reduce((sum, r) => sum + (r.capacity_tons || 0) * (r.flights_per_week || 0) / 7, 0)
    }
    const r = routes.find(r => String(r.id) === selectedRoute)
    return r ? (r.capacity_tons || 0) * (r.flights_per_week || 0) / 7 : 0
  }, [routes, selectedRoute])

  const chartOption = useMemo(() => {
    // Aggregate by date: sum tons across routes when viewing all
    const histAgg = new Map<string, number>()
    for (const h of history) {
      histAgg.set(h.date, (histAgg.get(h.date) || 0) + (h.actual_tons || 0))
    }
    const predAgg = new Map<string, { tons: number; low: number; high: number }>()
    for (const p of predictions) {
      const key = p.target_date || ''
      const prev = predAgg.get(key) || { tons: 0, low: 0, high: 0 }
      predAgg.set(key, {
        tons: prev.tons + (p.predicted_tons || 0),
        low: prev.low + (p.confidence_low || 0),
        high: prev.high + (p.confidence_high || 0),
      })
    }

    const histDates = Array.from(histAgg.keys())
    const predDates = Array.from(predAgg.keys())
    const allDates = Array.from(new Set([...histDates, ...predDates])).sort()

    // Only show recent 90 days of history + all predictions
    const cutoff = allDates.filter(d => histAgg.has(d)).slice(-90)[0] || allDates[0]
    const displayDates = allDates.filter(d => d >= cutoff)

    const histSeries = displayDates.map(d => histAgg.get(d) ?? null)
    const predSeries = displayDates.map(d => predAgg.get(d)?.tons ?? null)
    const lowSeries = displayDates.map(d => predAgg.get(d)?.low ?? null)
    const highSeries = displayDates.map(d => predAgg.get(d)?.high ?? null)

    const markPoints = events
      .filter(e => displayDates.includes(e.start_date))
      .map(e => ({ name: e.name, xAxis: e.start_date, yAxis: histAgg.get(e.start_date) || predAgg.get(e.start_date)?.tons || 0 }))

    const cap85 = capacityPerDay * 0.85
    const cap95 = capacityPerDay * 0.95

    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['实际货量', '预测货量', '置信上限', '置信下限'], top: 0, textStyle: { color: '#6B7280' } },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category' as const, data: displayDates, axisLabel: { fontSize: 10, color: '#6B7280' } },
      yAxis: { type: 'value' as const, name: '吨', axisLabel: { color: '#6B7280' }, splitLine: { lineStyle: { color: '#F3F4F6' } } },
      series: [
        { name: '实际货量', type: 'line', data: histSeries, lineStyle: { color: '#111827', width: 2 }, itemStyle: { color: '#111827' }, symbol: 'circle', symbolSize: 3,
          markPoint: markPoints.length ? { data: markPoints.map(mp => ({ ...mp, symbol: 'diamond', symbolSize: 10, itemStyle: { color: '#F59E0B' }, label: { show: true, formatter: mp.name, fontSize: 9, position: 'top' as const } })) } : undefined },
        { name: '预测货量', type: 'line', data: predSeries, lineStyle: { color: '#6B7280', width: 2, type: 'dashed' as const }, itemStyle: { color: '#6B7280' }, symbol: 'circle', symbolSize: 3 },
        { name: '置信上限', type: 'line', data: highSeries, lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 }, areaStyle: { color: 'rgba(107,114,128,0.08)' }, stack: 'confidence', symbol: 'none' },
        { name: '置信下限', type: 'line', data: lowSeries, lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 }, areaStyle: { color: 'rgba(107,114,128,0.08)' }, stack: 'confidence', symbol: 'none' },
        ...(capacityPerDay > 0 ? [
          { name: '运力上限', type: 'line' as const, data: displayDates.map(() => capacityPerDay), lineStyle: { color: '#EF4444', width: 1, type: 'dashed' as const }, itemStyle: { opacity: 0 }, symbol: 'none' },
          { name: '最优区间', type: 'line' as const, markArea: { silent: true, data: [[{ yAxis: cap85, itemStyle: { color: 'rgba(16,185,129,0.06)' } }, { yAxis: cap95 }]] }, lineStyle: { opacity: 0 }, symbol: 'none', data: [] as number[] },
        ] : []),
      ],
    }
  }, [history, predictions, events, capacityPerDay])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">预测走势图</h1>
          <p className="page-desc">历史货量与 AI 预测对比，运力基准参考</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="select w-36" value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}>
            <option value="all">全部航线</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
          </select>
          <select className="select w-28" value={period} onChange={e => setPeriod(e.target.value as '7d' | '30d')}>
            <option value="7d">预测7天</option>
            <option value="30d">预测30天</option>
          </select>
          <button className="btn-primary" onClick={runPredict} disabled={predicting}>
            {predicting ? 'AI 预测中...' : '生成预测'}
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <Chart option={chartOption} height={420} />
      </div>

      {factors && (
        <div className="card">
          <h3 className="text-sm font-medium mb-2">AI 影响因素分析</h3>
          <p className="text-sm text-muted leading-relaxed">{factors}</p>
        </div>
      )}
    </div>
  )
}
