import { getSupabase } from '../server/supabase.js'
import { requireMethod, sendJson } from '../server/http.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return

  const rawId = req.query?.actividad_id
  const activityId = String(rawId || '')
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(activityId)) {
    return sendJson(res, 400, { error: 'La actividad indicada no es válida.' })
  }

  try {
    const { data, error } = await getSupabase()
      .from('vista_plantilla_completa')
      .select('actividad_id,material_id,material_nombre,marca_referencia,material_unidad_compra,rendimiento_m2,precio_referencial')
      .eq('actividad_id', activityId)

    if (error) {
      console.error('Supabase template query failed', {
        code: error.code,
        message: error.message
      })
      return sendJson(res, 502, { error: 'No se pudo cargar la plantilla de materiales.' })
    }
    return sendJson(res, 200, { materiales: data || [] })
  } catch {
    return sendJson(res, 500, { error: 'El servicio de plantillas no está configurado.' })
  }
}