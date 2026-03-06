const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
const DB_PATH = path.join(DB_DIR, 'forecast.db')

if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ========== Schema ==========
db.exec(`
  CREATE TABLE routes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE fleet_config (id INTEGER PRIMARY KEY AUTOINCREMENT, route_id INTEGER NOT NULL REFERENCES routes(id), aircraft_type TEXT NOT NULL, schedule TEXT NOT NULL, capacity_tons REAL NOT NULL, capacity_pieces INTEGER NOT NULL, quarter TEXT NOT NULL, flights_per_week INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE cargo_history (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, route_id INTEGER NOT NULL REFERENCES routes(id), actual_tons REAL, actual_pieces INTEGER, load_rate REAL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(date, route_id));
  CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, affected_routes TEXT, impact_percent REAL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, description TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE external_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL, category TEXT NOT NULL, enabled INTEGER DEFAULT 1, description TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE external_signals (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, source_id INTEGER REFERENCES external_sources(id), category TEXT NOT NULL, summary TEXT, value REAL, raw_text TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE predictions (id INTEGER PRIMARY KEY AUTOINCREMENT, predict_date TEXT NOT NULL, target_date TEXT NOT NULL, route_id INTEGER NOT NULL REFERENCES routes(id), predicted_tons REAL, confidence_low REAL, confidence_high REAL, factors TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE deviations (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, route_id INTEGER NOT NULL REFERENCES routes(id), predicted_tons REAL, actual_tons REAL, deviation_rate REAL, ai_analysis TEXT, tags TEXT, user_correction TEXT, confirmed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, route_id INTEGER REFERENCES routes(id), content TEXT NOT NULL, type TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE simulations (id INTEGER PRIMARY KEY AUTOINCREMENT, assumption TEXT NOT NULL, original_prediction TEXT, simulated_prediction TEXT, comparison TEXT, created_at TEXT DEFAULT (datetime('now')));
`)

// ========== Routes ==========
db.prepare('INSERT INTO routes (code, name) VALUES (?, ?)').run('US', '美线')
db.prepare('INSERT INTO routes (code, name) VALUES (?, ?)').run('EU', '欧线')
db.prepare('INSERT INTO routes (code, name) VALUES (?, ?)').run('IAN', '亚洲内线')

// ========== Fleet Config (2026Q1) ==========
db.prepare('INSERT INTO fleet_config (route_id, aircraft_type, schedule, capacity_tons, capacity_pieces, quarter, flights_per_week) VALUES (?,?,?,?,?,?,?)').run(1, 'B777F', '周一/周三/周五/周日', 100, 12000, '2026Q1', 4)
db.prepare('INSERT INTO fleet_config (route_id, aircraft_type, schedule, capacity_tons, capacity_pieces, quarter, flights_per_week) VALUES (?,?,?,?,?,?,?)').run(2, 'B747-8F', '周二/周四/周六', 110, 13500, '2026Q1', 3)
db.prepare('INSERT INTO fleet_config (route_id, aircraft_type, schedule, capacity_tons, capacity_pieces, quarter, flights_per_week) VALUES (?,?,?,?,?,?,?)').run(3, 'B767-300ERF', '周一至周五', 52, 6200, '2026Q1', 5)

// ========== External Sources ==========
const sources = [
  ['国家统计局', 'https://www.stats.gov.cn', '宏观经济', 'PMI 制造业指数'],
  ['上海航运交易所', 'https://www.sse.net.cn', '海运运价', 'SCFI 综合指数'],
  ['中国人民银行', 'https://www.pbc.gov.cn', '汇率', '人民币中间价'],
  ['中央气象台', 'https://www.nmc.cn', '天气', '深圳及航线目的地天气预警'],
  ['民航局', 'https://www.caac.gov.cn', '航空通告', 'NOTAM / 空域管制'],
  ['海关总署', 'https://www.customs.gov.cn', '贸易政策', '关税调整公告'],
  ['电商平台公告', 'https://www.example.com', '电商动态', '大促日期与招商节奏'],
]
const insertSource = db.prepare('INSERT INTO external_sources (name, url, category, description) VALUES (?,?,?,?)')
for (const s of sources) insertSource.run(...s)

// ========== Events ==========
const events = [
  ['春节假期', '节假日', null, -25, '2026-02-14', '2026-02-22', '春节假期，工厂停工，货量骤降'],
  ['春节前抢运', '季节性', null, 20, '2026-02-01', '2026-02-13', '春节前集中出货'],
  ['清明假期', '节假日', null, -8, '2026-04-04', '2026-04-06', '清明节小长假'],
  ['广交会第一期', '行业展会', 'US,EU', 12, '2025-10-15', '2025-10-19', '第136届广交会'],
  ['广交会第二期', '行业展会', 'US,EU', 10, '2025-10-23', '2025-10-27', '第136届广交会'],
  ['双十一大促', '电商大促', 'US,IAN', 22, '2025-11-01', '2025-11-15', '天猫/京东双十一，跨境电商出货高峰'],
  ['黑色星期五', '电商大促', 'US,EU', 28, '2025-11-21', '2025-12-01', 'Black Friday + Cyber Monday'],
  ['圣诞旺季', '季节性', 'US,EU', 18, '2025-12-01', '2025-12-20', '圣诞节前最后出货窗口'],
  ['元旦假期', '节假日', null, -10, '2025-12-31', '2026-01-02', '元旦小长假'],
  ['斋月', '节假日', 'IAN', -15, '2026-02-28', '2026-03-29', '东南亚/中东斋月，IAN线需求下降'],
  ['美国加征关税', '政策变动', 'US', 25, '2025-09-01', '2025-09-20', '美国宣布对华加征关税，引发抢出口'],
  ['CES消费电子展', '行业展会', 'US', 8, '2026-01-05', '2026-01-10', 'CES展会样品及展品集中出货'],
  ['五一假期', '节假日', null, -6, '2026-05-01', '2026-05-05', '五一劳动节'],
  ['618大促', '电商大促', 'US,IAN', 15, '2026-06-01', '2026-06-20', '京东618年中大促'],
  ['台风天鸽', '天气事件', null, -18, '2025-08-12', '2025-08-15', '台风影响深圳机场航班，货物滞留'],
  ['红海危机影响', '突发事件', 'EU', 15, '2025-07-01', '2025-07-31', '红海航运中断，欧线海运转空运'],
]
const insertEvent = db.prepare('INSERT INTO events (name, type, affected_routes, impact_percent, start_date, end_date, description) VALUES (?,?,?,?,?,?,?)')
for (const e of events) insertEvent.run(...e)

// ========== Cargo History (2024-01-01 ~ 2026-03-05) ==========
const routeParams = {
  1: { baseTons: 82, noise: 8 },   // US: 日均~82吨
  2: { baseTons: 68, noise: 7 },   // EU: 日均~68吨
  3: { baseTons: 32, noise: 4 },   // IAN: 日均~32吨
}
const dailyCapacity = { 1: 400/7, 2: 330/7, 3: 260/7 }

const seasonFactors = {
  0: 0.78,  // 1月 - 淡季
  1: 0.68,  // 2月 - 春节
  2: 0.88,  // 3月 - 恢复
  3: 0.93,  // 4月
  4: 0.96,  // 5月
  5: 0.94,  // 6月
  6: 0.90,  // 7月
  7: 0.95,  // 8月
  8: 1.08,  // 9月 - 旺季前奏
  9: 1.18,  // 10月 - 旺季
  10: 1.28, // 11月 - 黑五/双11
  11: 1.22, // 12月 - 圣诞
}

const dowFactors = [1.08, 1.05, 1.10, 1.04, 0.96, 0.78, 0.82]

function dateStr(d) {
  return d.toISOString().slice(0, 10)
}

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function getEventImpact(date, routeId) {
  const routeCodes = { 1: 'US', 2: 'EU', 3: 'IAN' }
  const code = routeCodes[routeId]
  let impact = 0
  for (const e of events) {
    if (date >= e[4] && date <= e[5]) {
      const affected = e[2]
      if (!affected || affected.includes(code)) {
        impact += e[3] / 100
      }
    }
  }
  return impact
}

const insertCargo = db.prepare('INSERT INTO cargo_history (date, route_id, actual_tons, actual_pieces, load_rate) VALUES (?,?,?,?,?)')

const startDate = new Date('2024-01-01')
const endDate = new Date('2026-03-05')

// Year-over-year growth
function yearGrowth(date) {
  const y = date.getFullYear()
  if (y === 2024) return 1.0
  if (y === 2025) return 1.06
  return 1.12
}

const cargoTx = db.transaction(() => {
  const d = new Date(startDate)
  while (d <= endDate) {
    const ds = dateStr(d)
    const month = d.getMonth()
    const dow = d.getDay()
    const sf = seasonFactors[month]
    const df = dowFactors[dow]
    const yg = yearGrowth(d)

    for (const routeId of [1, 2, 3]) {
      const p = routeParams[routeId]
      const eventImpact = getEventImpact(ds, routeId)
      const base = p.baseTons * sf * df * yg * (1 + eventImpact)
      const tons = Math.round((base + rand(-p.noise, p.noise)) * 10) / 10
      const pieces = Math.round(tons * rand(110, 130))
      const cap = dailyCapacity[routeId]
      const loadRate = Math.round(tons / cap * 1000) / 10

      insertCargo.run(ds, routeId, Math.max(0, tons), pieces, Math.min(loadRate, 120))
    }

    d.setDate(d.getDate() + 1)
  }
})
cargoTx()

// ========== External Signals (近3个月) ==========
const insertSignal = db.prepare('INSERT INTO external_signals (date, source_id, category, summary, value) VALUES (?,?,?,?,?)')
const signalData = [
  ['2026-03-05', 1, '宏观经济', '2月制造业PMI为50.2，重回扩张区间，新出口订单指数回升至49.8', 50.2],
  ['2026-03-04', 2, '海运运价', 'SCFI综合指数报1856点，环比上涨3.2%，欧线运价涨幅领先', 1856],
  ['2026-03-03', 3, '汇率', '人民币中间价报7.1892，较上日贬值42个基点', 7.1892],
  ['2026-03-02', 4, '天气', '深圳未来一周多云为主，无极端天气预警，航班运行正常', null],
  ['2026-03-01', 5, '航空通告', '华南地区空域无特殊管制，深圳机场正常运行', null],
  ['2026-02-28', 6, '贸易政策', '海关总署发布2026年第12号公告，部分电子产品出口退税率调整', null],
  ['2026-02-25', 1, '宏观经济', '1月出口同比增长8.3%，超市场预期，机电产品出口保持强劲', 8.3],
  ['2026-02-20', 2, '海运运价', 'SCFI综合指数报1798点，春节后运价企稳回升', 1798],
  ['2026-02-15', 3, '汇率', '春节后人民币小幅升值，中间价报7.1650', 7.165],
  ['2026-02-10', 7, '电商动态', 'Temu、SHEIN Q1备货需求旺盛，跨境电商小包出口预计同比增长15%', 15],
  ['2026-01-28', 1, '宏观经济', '12月制造业PMI为50.5，连续3个月处于扩张区间', 50.5],
  ['2026-01-20', 2, '海运运价', 'SCFI报1720点，春节前夕运价季节性回落', 1720],
  ['2026-01-15', 4, '天气', '深圳气温骤降至8°C，部分航班延误，但未造成大规模取消', null],
  ['2026-01-10', 6, '贸易政策', '2026年RCEP新增条款生效，亚洲内线贸易便利化程度提升', null],
  ['2025-12-28', 1, '宏观经济', '11月PMI为50.8，制造业景气度持续改善', 50.8],
  ['2025-12-20', 2, '海运运价', 'SCFI报2105点，圣诞旺季推动运价上行', 2105],
  ['2025-12-15', 7, '电商动态', '黑五+网一期间跨境电商GMV同比增长22%，空运需求超预期', 22],
]
for (const s of signalData) insertSignal.run(...s)

// ========== Predictions (未来30天: 2026-03-06 ~ 2026-04-04) ==========
const insertPred = db.prepare('INSERT INTO predictions (predict_date, target_date, route_id, predicted_tons, confidence_low, confidence_high, factors) VALUES (?,?,?,?,?,?,?)')
const predFactors = '3月处于春节后恢复期，货量逐步回升。PMI重回扩张区间利好出口，海运运价温和上涨推动部分客户选择空运。斋月影响IAN线需求，预计持续至3月底。关注Temu/SHEIN跨境电商备货节奏，可能带来额外增量。'

const predTx = db.transaction(() => {
  for (let i = 0; i < 30; i++) {
    const d = new Date('2026-03-06')
    d.setDate(d.getDate() + i)
    const ds = dateStr(d)
    const dow = d.getDay()
    const df = dowFactors[dow]

    // 3月逐步恢复的趋势
    const recoveryFactor = 0.88 + (i / 30) * 0.08

    for (const routeId of [1, 2, 3]) {
      const p = routeParams[routeId]
      const yg = 1.12
      let base = p.baseTons * recoveryFactor * df * yg

      // IAN线斋月影响
      if (routeId === 3 && ds <= '2026-03-29') base *= 0.85

      const tons = Math.round(base * 10) / 10
      const low = Math.round((tons * 0.88) * 10) / 10
      const high = Math.round((tons * 1.12) * 10) / 10

      insertPred.run('2026-03-06', ds, routeId, tons, low, high, predFactors)
    }
  }
})
predTx()

// ========== Deviations (近45天: 2026-01-20 ~ 2026-03-05) ==========
const insertDev = db.prepare('INSERT INTO deviations (date, route_id, predicted_tons, actual_tons, deviation_rate, ai_analysis, tags, confirmed) VALUES (?,?,?,?,?,?,?,?)')

const deviationAnalyses = [
  { rate: 12.3, analysis: '春节前抢运效应超预期，大量电子产品集中出货，实际货量显著高于预测。跨境电商平台Temu备货需求集中释放是主要增量来源。', tags: ['季节性', '电商'], confirmed: 1 },
  { rate: -8.5, analysis: '春节假期工厂停工导致货量低于预期，部分客户提前完成出货导致节前最后两天货量回落。', tags: ['季节性'], confirmed: 1 },
  { rate: -22.1, analysis: '春节假期期间货量大幅下降，符合历史规律但降幅超预测。今年春节较晚，部分客户已在节前完成全部出货。', tags: ['季节性'], confirmed: 1 },
  { rate: 6.8, analysis: 'PMI数据超预期（50.2 vs预期49.8），出口信心提振，部分订单提前释放。', tags: ['宏观经济'], confirmed: 1 },
  { rate: -5.2, analysis: '深圳突降暴雨导致部分货物运输延误，当日到港货量减少。', tags: ['天气'], confirmed: 1 },
  { rate: 15.7, analysis: '海运运价上涨推动部分中高价值货物转空运，特别是欧线方向。SCFI指数突破1850点是关键触发因素。', tags: ['海运替代'], confirmed: 1 },
  { rate: -11.3, analysis: '竞争对手降价揽货导致部分中小客户流失，美线方向尤为明显。', tags: ['竞争'], confirmed: 0 },
  { rate: 9.4, analysis: '美国对华关税政策不确定性增加，部分客户提前出货以规避风险。', tags: ['政策'], confirmed: 1 },
  { rate: -3.2, analysis: '偏差在合理范围内，无明显单一因素，属于正常波动。', tags: [], confirmed: 1 },
  { rate: 7.1, analysis: '斋月前东南亚客户集中补货，IAN线出现短期需求脉冲。', tags: ['季节性'], confirmed: 1 },
  { rate: -14.6, analysis: '斋月正式开始，IAN线需求大幅回落，降幅略超历史均值。今年斋月采购提前结束是主因。', tags: ['季节性'], confirmed: 1 },
  { rate: 4.5, analysis: 'SHEIN春季新品上架带动小包出口增量，主要体现在美线方向。', tags: ['电商'], confirmed: 0 },
]

const devTx = db.transaction(() => {
  const d = new Date('2026-01-20')
  let devIdx = 0
  while (d <= new Date('2026-03-05')) {
    const ds = dateStr(d)
    const dow = d.getDay()
    const month = d.getMonth()
    const sf = seasonFactors[month]
    const df = dowFactors[dow]

    for (const routeId of [1, 2, 3]) {
      const p = routeParams[routeId]
      const eventImpact = getEventImpact(ds, routeId)
      const base = p.baseTons * sf * df * 1.12 * (1 + eventImpact)
      const actualTons = Math.round((base + rand(-p.noise, p.noise)) * 10) / 10

      // Every 3-4 days, create a notable deviation
      if ((devIdx % 3 === 0 || Math.random() < 0.15) && deviationAnalyses.length > 0) {
        const template = deviationAnalyses[devIdx % deviationAnalyses.length]
        const deviationRate = template.rate * (0.8 + Math.random() * 0.4) * (routeId === 3 ? 0.7 : 1)
        const predictedTons = Math.round(actualTons / (1 + deviationRate / 100) * 10) / 10

        insertDev.run(ds, routeId, predictedTons, actualTons,
          Math.round(deviationRate * 10) / 10,
          template.analysis, JSON.stringify(template.tags), template.confirmed)
      }
      devIdx++
    }
    d.setDate(d.getDate() + 1)
  }
})
devTx()

// ========== Decisions ==========
const insertDecision = db.prepare('INSERT INTO decisions (date, route_id, content, type, status) VALUES (?,?,?,?,?)')
const decisionsData = [
  ['2026-03-05', 1, '美线装载率连续5天低于85%（均值81.2%），建议对Saver产品降价8-10%促量，预计可带来+6%货量增长。重点定向推广深圳3C电子客户群。', 'surplus', 'pending'],
  ['2026-03-05', 2, '欧线受海运运价上涨驱动，装载率升至93.5%，接近运力上限。建议WEPS产品提价5%，优先保障高价值客户舱位。', 'shortage', 'pending'],
  ['2026-03-05', 3, '斋月期间IAN线装载率仅72%，建议合并周三/周五两班为一班，释放一架B767给其他枢纽。减少临时工排班至最低配置。', 'surplus', 'pending'],
  ['2026-03-04', 1, '预测3月中旬美线货量将恢复至日均85吨以上，建议提前协调ULD调配，确保充足板箱供应。', 'shortage', 'adopted'],
  ['2026-03-03', 2, '欧线3月第一周Booking已达周运力的88%，建议启动加班机评估流程，预估加班机成本约$45,000/班，收益约$62,000。', 'shortage', 'adopted'],
  ['2026-03-01', 1, '春节后美线恢复速度慢于预期，建议对IDC产品推出"节后复工特价"，有效期2周。历史数据显示此策略平均带来+9%货量。', 'surplus', 'adopted'],
  ['2026-02-28', 3, '斋月开始，IAN线预计持续低迷至3月底。建议将2架ULD转移至香港枢纽支援HKG-BKK航线。', 'surplus', 'adopted'],
  ['2026-02-25', 2, '欧线装载率回升至90%，IDC价格可考虑上调3%测试市场反应。', 'shortage', 'ignored'],
  ['2026-02-20', 1, '美线部分中小客户流向竞对，建议销售团队针对性回访Top 20流失风险客户，提供定制化报价方案。', 'surplus', 'adopted'],
]
for (const d of decisionsData) insertDecision.run(...d)

// ========== Simulations ==========
const insertSim = db.prepare('INSERT INTO simulations (assumption, original_prediction, simulated_prediction, comparison, created_at) VALUES (?,?,?,?,?)')
const simData = [
  [
    '增加一班美线B777F航班（周二）',
    JSON.stringify([
      { date: '2026-03-06', route: 'US', tons: 82.5 }, { date: '2026-03-07', route: 'US', tons: 85.1 },
      { date: '2026-03-08', route: 'US', tons: 78.3 }, { date: '2026-03-09', route: 'US', tons: 70.2 },
    ]),
    JSON.stringify([
      { date: '2026-03-06', route: 'US', tons: 82.5 }, { date: '2026-03-07', route: 'US', tons: 105.2 },
      { date: '2026-03-08', route: 'US', tons: 78.3 }, { date: '2026-03-09', route: 'US', tons: 70.2 },
    ]),
    '增加周二一班B777F后，美线周运力从400吨提升至500吨，装载率预计从88%降至70%。在当前货量水平下，新增航班难以填满，建议配合降价促量或待旺季再启用。加班机成本约$52,000，按当前运价收入约$38,000，单班亏损约$14,000。',
    '2026-03-04 10:30:00',
  ],
  [
    '海运运价上涨30%',
    JSON.stringify([
      { date: '2026-03-06', route: 'EU', tons: 68.3 }, { date: '2026-03-07', route: 'EU', tons: 71.2 },
      { date: '2026-03-08', route: 'EU', tons: 55.6 }, { date: '2026-03-09', route: 'EU', tons: 48.3 },
    ]),
    JSON.stringify([
      { date: '2026-03-06', route: 'EU', tons: 75.8 }, { date: '2026-03-07', route: 'EU', tons: 79.5 },
      { date: '2026-03-08', route: 'EU', tons: 62.1 }, { date: '2026-03-09', route: 'EU', tons: 54.6 },
    ]),
    '海运运价上涨30%将推动约11-13%的中高价值货物从海运转向空运，欧线受影响最大。预计欧线日均货量增加8-10吨，装载率将突破95%。建议提前准备加班机方案，并适度提价5-8%以管理需求。',
    '2026-03-03 14:15:00',
  ],
  [
    '黑五提前一周（11月14日开始）',
    JSON.stringify([
      { date: '2025-11-14', route: 'US', tons: 92.1 }, { date: '2025-11-15', route: 'US', tons: 95.3 },
      { date: '2025-11-16', route: 'US', tons: 88.7 }, { date: '2025-11-17', route: 'US', tons: 83.2 },
    ]),
    JSON.stringify([
      { date: '2025-11-14', route: 'US', tons: 108.5 }, { date: '2025-11-15', route: 'US', tons: 112.3 },
      { date: '2025-11-16', route: 'US', tons: 104.1 }, { date: '2025-11-17', route: 'US', tons: 98.6 },
    ]),
    '黑五提前一周意味着备货窗口提前，美线货量高峰将从11月21日前移至11月14日。预计峰值日货量达112吨，超出单日运力上限（57吨/日均）。需提前安排2班加班机，并启动HKG转港预案。',
    '2026-02-28 09:45:00',
  ],
  [
    '深圳未来一周台风预警',
    JSON.stringify([
      { date: '2026-03-06', route: 'US', tons: 82.5 }, { date: '2026-03-06', route: 'EU', tons: 68.3 },
      { date: '2026-03-06', route: 'IAN', tons: 28.1 },
    ]),
    JSON.stringify([
      { date: '2026-03-06', route: 'US', tons: 45.2 }, { date: '2026-03-06', route: 'EU', tons: 38.7 },
      { date: '2026-03-06', route: 'IAN', tons: 15.3 },
    ]),
    '台风期间深圳机场可能取消50-70%航班，所有航线货量大幅下降。但台风过后2-3天将出现滞留货物集中释放，预计货量反弹至正常水平的130-140%。建议提前通知客户分流至HKG/CAN机场，并预留台风后的加班机资源。',
    '2026-03-01 16:20:00',
  ],
]
for (const s of simData) insertSim.run(...s)

db.close()

const cargoCount = 796 * 3  // ~796 days * 3 routes
console.log('✓ 种子数据生成完成：')
console.log(`  航线：3条（US/EU/IAN）`)
console.log(`  运力配置：3条`)
console.log(`  历史货量：~${cargoCount}条（2024-01-01 ~ 2026-03-05）`)
console.log(`  事件：${events.length}条`)
console.log(`  外部数据源：${sources.length}个`)
console.log(`  外部情报：${signalData.length}条`)
console.log(`  预测记录：90条（未来30天×3航线）`)
console.log(`  偏差归因：~100+条`)
console.log(`  决策建议：${decisionsData.length}条`)
console.log(`  模拟记录：${simData.length}条`)
