import { calculateBudget } from '../server/calculation.js'
import { readJsonBody, requireMethod, sendJson } from '../server/http.js'
import { createQuotePdf } from '../server/pdf.js'
import { getQuoteCount, MONTHLY_QUOTE_LIMIT, setQuoteCount } from '../server/quota.js'

export default function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return

  let body
  try {
    body = readJsonBody(req)
    const count = getQuoteCount(req)
    if (count >= MONTHLY_QUOTE_LIMIT) {
      return sendJson(res, 429, { error: 'Alcanzaste el límite mensual de cotizaciones.', restantes: 0 })
    }

    const budget = calculateBudget(body)
    const { buffer, filename } = createQuotePdf(body, budget)
    const remaining = MONTHLY_QUOTE_LIMIT - count - 1

    setQuoteCount(res, count + 1)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-Quotes-Remaining', String(remaining))
    return res.status(200).send(buffer)
  } catch (error) {
    const status = error.message?.includes('SECRET') ? 500 : 400
    return sendJson(res, status, { error: error.message || 'No se pudo generar la cotización.' })
  }
}