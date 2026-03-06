const API_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions'
const API_KEY = '59c4af77e1534f278f49fd3f56159eab.auO89JqQFYEZnVbV'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callAI(messages: Message[]): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4.7',
      messages,
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API error: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function predictCargo(context: {
  historyData: string
  routeConfig: string
  events: string
  signals: string
  deviations: string
  period: '1d' | '7d' | '30d'
}): Promise<string> {
  const periodLabel = { '1d': '未来1天', '7d': '未来7天', '30d': '未来30天' }[context.period]

  return callAI([
    {
      role: 'system',
      content: `你是DHL深圳枢纽的航空货运产能预测专家。根据提供的历史数据、运力配置、事件日历、外部情报和历史偏差归因，预测${periodLabel}每天各航线的货量（吨）。

输出严格JSON格式：
{
  "predictions": [
    { "date": "YYYY-MM-DD", "route": "航线代码", "predicted_tons": 数值, "confidence_low": 数值, "confidence_high": 数值 }
  ],
  "factors": "影响因素分析（文字说明，200字内）"
}

注意：
- 置信区间为预测值的上下浮动范围
- 综合考虑季节性、近期趋势、事件影响、外部信号
- 参考历史偏差归因中的经验教训`,
    },
    {
      role: 'user',
      content: `【历史货量数据】\n${context.historyData}\n\n【航线运力配置】\n${context.routeConfig}\n\n【事件日历】\n${context.events}\n\n【外部情报】\n${context.signals}\n\n【历史偏差归因】\n${context.deviations}\n\n请预测${periodLabel}各航线每日货量。`,
    },
  ])
}

export async function analyzeDeviation(context: {
  date: string
  route: string
  predicted: number
  actual: number
  recentData: string
  events: string
  signals: string
}): Promise<string> {
  const deviationRate = ((context.actual - context.predicted) / context.predicted * 100).toFixed(1)

  return callAI([
    {
      role: 'system',
      content: `你是航空货运偏差分析专家。分析预测值与实际值的偏差原因。

输出严格JSON格式：
{
  "analysis": "偏差原因分析（200字内）",
  "tags": ["归因标签1", "归因标签2"],
  "severity": "high|medium|low"
}

可选标签：宏观经济、政策、季节性、电商、竞争、海运替代、天气、突发事件`,
    },
    {
      role: 'user',
      content: `日期：${context.date}，航线：${context.route}\n预测值：${context.predicted}吨，实际值：${context.actual}吨，偏差率：${deviationRate}%\n\n【近期数据】\n${context.recentData}\n\n【相关事件】\n${context.events}\n\n【外部情报】\n${context.signals}\n\n请分析偏差原因。`,
    },
  ])
}

export async function generateDecisions(context: {
  loadRates: string
  deviations: string
  trends: string
}): Promise<string> {
  return callAI([
    {
      role: 'system',
      content: `你是航空货运决策顾问。基于装载率和偏差趋势，给出运营建议。

输出严格JSON格式：
{
  "decisions": [
    { "route": "航线代码", "type": "surplus|shortage", "suggestion": "建议内容", "priority": "high|medium|low" }
  ]
}

运力过剩时建议：降价促量、合并航班、减少临时工
运力不足时建议：提价、加班机、转港、增加班次`,
    },
    {
      role: 'user',
      content: `【各航线装载率】\n${context.loadRates}\n\n【近期偏差趋势】\n${context.deviations}\n\n【货量趋势】\n${context.trends}\n\n请给出决策建议。`,
    },
  ])
}

export async function simulateWhatIf(context: {
  currentData: string
  assumption: string
}): Promise<string> {
  return callAI([
    {
      role: 'system',
      content: `你是航空货运模拟分析师。基于当前数据和用户假设条件，重新预测未来7天货量。

输出严格JSON格式：
{
  "original": [{ "date": "YYYY-MM-DD", "route": "航线代码", "tons": 数值 }],
  "simulated": [{ "date": "YYYY-MM-DD", "route": "航线代码", "tons": 数值 }],
  "analysis": "模拟分析说明（200字内）"
}`,
    },
    {
      role: 'user',
      content: `【当前数据与预测】\n${context.currentData}\n\n【假设条件】\n${context.assumption}\n\n请基于假设条件重新预测。`,
    },
  ])
}

export async function summarizeSignal(rawText: string, category: string): Promise<string> {
  return callAI([
    {
      role: 'system',
      content: `从以下网页内容中提取与"${category}"相关的关键信息。输出JSON：
{ "summary": "摘要（100字内）", "value": 数值或null, "relevance": "high|medium|low" }`,
    },
    { role: 'user', content: rawText.slice(0, 4000) },
  ])
}
