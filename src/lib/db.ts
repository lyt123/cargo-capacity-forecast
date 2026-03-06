import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'forecast.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require('fs')
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fleet_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL REFERENCES routes(id),
      aircraft_type TEXT NOT NULL,
      schedule TEXT NOT NULL,
      capacity_tons REAL NOT NULL,
      capacity_pieces INTEGER NOT NULL,
      quarter TEXT NOT NULL,
      flights_per_week INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cargo_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      route_id INTEGER NOT NULL REFERENCES routes(id),
      actual_tons REAL,
      actual_pieces INTEGER,
      load_rate REAL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(date, route_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      affected_routes TEXT,
      impact_percent REAL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS external_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS external_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      source_id INTEGER REFERENCES external_sources(id),
      category TEXT NOT NULL,
      summary TEXT,
      value REAL,
      raw_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      predict_date TEXT NOT NULL,
      target_date TEXT NOT NULL,
      route_id INTEGER NOT NULL REFERENCES routes(id),
      predicted_tons REAL,
      confidence_low REAL,
      confidence_high REAL,
      factors TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deviations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      route_id INTEGER NOT NULL REFERENCES routes(id),
      predicted_tons REAL,
      actual_tons REAL,
      deviation_rate REAL,
      ai_analysis TEXT,
      tags TEXT,
      user_correction TEXT,
      confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      route_id INTEGER REFERENCES routes(id),
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assumption TEXT NOT NULL,
      original_prediction TEXT,
      simulated_prediction TEXT,
      comparison TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Seed default external sources
  const count = db.prepare('SELECT COUNT(*) as c FROM external_sources').get() as { c: number }
  if (count.c === 0) {
    const insert = db.prepare('INSERT INTO external_sources (name, url, category, description) VALUES (?, ?, ?, ?)')
    const sources = [
      ['国家统计局', 'https://www.stats.gov.cn', '宏观经济', 'PMI 制造业指数'],
      ['上海航运交易所', 'https://www.sse.net.cn', '海运运价', 'SCFI 综合指数'],
      ['中国人民银行', 'https://www.pbc.gov.cn', '汇率', '人民币中间价'],
      ['中央气象台', 'https://www.nmc.cn', '天气', '天气预警信息'],
      ['民航局', 'https://www.caac.gov.cn', '航空通告', 'NOTAM / 空域管制'],
      ['海关总署', 'https://www.customs.gov.cn', '贸易政策', '关税调整公告'],
      ['电商平台公告', 'https://www.example.com', '电商动态', '大促日期与招商节奏'],
    ]
    for (const s of sources) insert.run(...s)
  }

  // Seed default routes
  const routeCount = db.prepare('SELECT COUNT(*) as c FROM routes').get() as { c: number }
  if (routeCount.c === 0) {
    const insert = db.prepare('INSERT INTO routes (code, name) VALUES (?, ?)')
    insert.run('US', '美线')
    insert.run('EU', '欧线')
    insert.run('IAN', '亚洲内线')
  }
}
