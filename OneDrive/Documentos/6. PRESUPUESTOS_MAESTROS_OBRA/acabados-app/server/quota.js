import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'acabados_quote_usage'
export const MONTHLY_QUOTE_LIMIT = 10

const currentMonth = () => {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

const getSecret = () => {
  const secret = process.env.QUOTE_COOKIE_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('QUOTE_COOKIE_SECRET must contain at least 32 characters')
  }
  return secret
}

const sign = (payload, secret) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

export const getQuoteCount = (req) => {
  const cookies = req.headers.cookie || ''
  const cookie = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))
  if (!cookie) return 0

  const value = cookie.slice(COOKIE_NAME.length + 1)
  const separator = value.lastIndexOf('.')
  if (separator < 1) return 0

  const payload = value.slice(0, separator)
  const providedSignature = Buffer.from(value.slice(separator + 1), 'base64url')
  const expectedSignature = Buffer.from(sign(payload, getSecret()), 'base64url')
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) return 0

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (data.month !== currentMonth()) return 0
    if (!Number.isInteger(data.count) || data.count < 0 || data.count > MONTHLY_QUOTE_LIMIT) return 0
    return data.count
  } catch {
    return 0
  }
}

export const setQuoteCount = (res, count) => {
  const secret = getSecret()
  const payload = Buffer.from(JSON.stringify({ month: currentMonth(), count })).toString('base64url')
  const value = `${payload}.${sign(payload, secret)}`
  const now = new Date()
  const endOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  const maxAge = Math.max(0, Math.floor((endOfMonth - now.getTime()) / 1000))
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''

  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
}