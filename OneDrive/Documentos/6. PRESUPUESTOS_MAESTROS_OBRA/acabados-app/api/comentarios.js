import { getSupabase } from '../server/supabase.js'
import { readJsonBody, requireMethod, sendJson } from '../server/http.js'

const TIPOS_VALIDOS = new Set(['sugerencia', 'problema', 'comentario'])

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return

  let body
  try {
    body = readJsonBody(req)
  } catch {
    return sendJson(res, 400, { error: 'El comentario no tiene un formato válido.' })
  }

  const tipo = body.tipo
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : ''
  if (!TIPOS_VALIDOS.has(tipo) || mensaje.length < 8 || mensaje.length > 1000) {
    return sendJson(res, 400, { error: 'Revisa el tipo y la longitud del comentario.' })
  }

  try {
    const { error } = await getSupabase().from('comentarios').insert({ tipo, mensaje })
    if (error) return sendJson(res, 502, { error: 'No se pudo registrar el comentario.' })
    return sendJson(res, 201, { ok: true })
  } catch {
    return sendJson(res, 500, { error: 'El servicio de comentarios no está configurado.' })
  }
}