import { MONTHLY_QUOTE_LIMIT, getQuoteCount } from '../server/quota.js'
import { requireMethod, sendJson } from '../server/http.js'

export default function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return

  try {
    const usados = getQuoteCount(req)
    return sendJson(res, 200, {
      limite: MONTHLY_QUOTE_LIMIT,
      restantes: Math.max(0, MONTHLY_QUOTE_LIMIT - usados)
    })
  } catch {
    return sendJson(res, 500, { error: 'El control de cotizaciones no está configurado.' })
  }
}