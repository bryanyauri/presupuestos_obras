import { calculateBudget } from '../server/calculation.js'
import { readJsonBody, requireMethod, sendJson } from '../server/http.js'

export default function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return

  try {
    const budget = calculateBudget(readJsonBody(req))
    return sendJson(res, 200, budget)
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Los datos del presupuesto no son válidos.' })
  }
}