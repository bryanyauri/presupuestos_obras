export const sendJson = (res, status, payload) => {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(payload)
}

export const requireMethod = (req, res, method) => {
  if (req.method === method) return true

  res.setHeader('Allow', method)
  sendJson(res, 405, { error: 'Método no permitido.' })
  return false
}

export const readJsonBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}