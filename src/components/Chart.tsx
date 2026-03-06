'use client'
import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'

interface ChartProps {
  option: Record<string, unknown>
  height?: number
  className?: string
}

export default function Chart({ option, height = 400, className = '' }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current)
    }
    chartRef.current.setOption(option as echarts.EChartsOption, true)
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect() }
  }, [option])

  useEffect(() => {
    return () => { chartRef.current?.dispose() }
  }, [])

  return <div ref={ref} style={{ height }} className={className} />
}
