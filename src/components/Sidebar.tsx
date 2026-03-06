'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: '总览', href: '/', icon: '◻' },
  { label: '预测走势', href: '/forecast', icon: '◇' },
  { label: '每日提交', href: '/daily-submit', icon: '◈' },
  { divider: true, label: '数据管理' },
  { label: '数据导入', href: '/data/import', icon: '▲' },
  { label: '历史数据', href: '/data/history', icon: '▤' },
  { divider: true, label: '系统配置' },
  { label: '航线与运力', href: '/config/routes', icon: '▸' },
  { label: '事件管理', href: '/config/events', icon: '▹' },
  { label: '数据源', href: '/config/sources', icon: '▻' },
  { divider: true, label: '分析工具' },
  { label: '归因知识库', href: '/analysis/attribution', icon: '▦' },
  { label: '预测回测', href: '/analysis/backtest', icon: '▧' },
  { label: 'What-if 模拟', href: '/simulation', icon: '▨' },
  { label: '决策建议', href: '/decisions', icon: '▩' },
] as const

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 h-screen bg-white border-r border-border flex flex-col fixed left-0 top-0 z-10">
      <div className="px-5 py-5 border-b border-border">
        <h1 className="text-sm font-bold tracking-wide text-neutral-900">DHL 产能预测</h1>
        <p className="text-xs text-muted mt-0.5">深圳枢纽</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((item, i) => {
          if ('divider' in item && item.divider) {
            return (
              <div key={i} className="px-5 pt-5 pb-1.5 text-[10px] font-semibold text-muted uppercase tracking-widest">
                {item.label}
              </div>
            )
          }
          const active = 'href' in item && pathname === item.href
          return (
            <Link
              key={i}
              href={'href' in item ? item.href : '/'}
              className={`flex items-center gap-2.5 px-5 py-2 text-sm transition-colors ${
                active
                  ? 'text-neutral-900 bg-neutral-100 font-medium'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              <span className="text-[11px] w-4 text-center">{'icon' in item ? item.icon : ''}</span>
              {'label' in item ? item.label : ''}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
