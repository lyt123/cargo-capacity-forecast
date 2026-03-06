'use client'
import { api } from '@/lib/config'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false })

interface DashboardData {
  loadRates: { route: string; routeName: string; loadRate: number; latestTons: number; dailyCapacity: number; date: string }[]
  stats: { totalRecords: number; totalPredictions: number; totalDeviations: number; avgDeviation: number }
  recentDeviations: { date: string; code: string; deviation_rate: number; tags: string }[]
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetch(api('/api/dashboard')).then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="text-center py-20 text-muted">加载中...</div>

  function getStatus(rate: number) {
    if (!rate) return { label: '无数据', color: 'bg-neutral-100 text-neutral-500' }
    if (rate >= 85 && rate <= 95) return { label: '最优', color: 'bg-emerald-50 text-emerald-700' }
    if (rate < 85) return { label: '运力过剩', color: 'bg-amber-50 text-amber-700' }
    return { label: '运力不足', color: 'bg-red-50 text-red-700' }
  }

  const gaugeOption = (rate: number, name: string) => ({
    series: [{
      type: 'gauge' as const,
      startAngle: 200, endAngle: -20,
      min: 0, max: 100,
      radius: '90%',
      progress: { show: true, width: 14, itemStyle: { color: rate >= 85 && rate <= 95 ? '#10B981' : rate > 95 ? '#EF4444' : '#F59E0B' } },
      pointer: { show: false },
      axisLine: { lineStyle: { width: 14, color: [[1, '#F3F4F6']] } },
      axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: true, offsetCenter: [0, '65%'], fontSize: 12, color: '#6B7280' },
      detail: { valueAnimation: true, fontSize: 24, fontWeight: 600, offsetCenter: [0, '20%'], color: '#111827', formatter: '{value}%' },
      data: [{ value: rate, name }],
    }],
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">系统总览</h1>
        <p className="page-desc">DHL 深圳枢纽产能预测仪表盘</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '历史数据量', value: data.stats.totalRecords, unit: '条' },
          { label: '预测记录', value: data.stats.totalPredictions, unit: '条' },
          { label: '偏差记录', value: data.stats.totalDeviations, unit: '条' },
          { label: '近30天平均偏差', value: data.stats.avgDeviation, unit: '%' },
        ].map((s, i) => (
          <div key={i} className="card">
            <div className="text-xs text-muted mb-1">{s.label}</div>
            <div className="text-2xl font-semibold">{s.value}<span className="text-sm text-muted ml-1">{s.unit}</span></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {data.loadRates.map((lr, i) => {
          const status = getStatus(lr.loadRate)
          return (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{lr.route} - {lr.routeName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
              </div>
              <Chart option={gaugeOption(lr.loadRate, lr.route)} height={180} />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted mt-1">
                <div>最新货量：{lr.latestTons} 吨</div>
                <div>日运力：{lr.dailyCapacity.toFixed(1)} 吨</div>
              </div>
            </div>
          )
        })}
        {data.loadRates.length === 0 && <div className="col-span-3 card text-center text-muted py-8">请先配置航线运力并导入数据</div>}
      </div>

      <div className="card">
        <h3 className="text-sm font-medium mb-3">近期偏差记录</h3>
        <table className="table-base">
          <thead><tr><th>日期</th><th>航线</th><th>偏差率</th><th>归因标签</th></tr></thead>
          <tbody>
            {data.recentDeviations.map((d, i) => (
              <tr key={i}>
                <td>{d.date}</td>
                <td className="font-medium">{d.code}</td>
                <td className={Math.abs(d.deviation_rate) > 10 ? 'text-red-600 font-medium' : 'text-muted'}>
                  {d.deviation_rate > 0 ? '+' : ''}{d.deviation_rate}%
                </td>
                <td>{d.tags ? JSON.parse(d.tags).map((t: string, j: number) => <span key={j} className="tag-gray mr-1">{t}</span>) : '-'}</td>
              </tr>
            ))}
            {data.recentDeviations.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-6">暂无偏差记录</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
