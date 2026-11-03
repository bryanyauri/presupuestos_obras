import { getSupabase } from '../server/supabase.js'
import { requireMethod, sendJson } from '../server/http.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return

  try {
    const supabase = getSupabase()
    const [activitiesResult, materialsResult] = await Promise.all([
      supabase.from('actividades').select('id,nombre,categoria,unidad_medida').order('id'),
      supabase.from('materiales').select('id,nombre,marca_referencia,unidad_medida,precio_referencial').order('nombre')
    ])

    if (activitiesResult.error || materialsResult.error) {
      console.error('Supabase catalog query failed', {
        activities: activitiesResult.error && {
          code: activitiesResult.error.code,
          message: activitiesResult.error.message
        },
        materials: materialsResult.error && {
          code: materialsResult.error.code,
          message: materialsResult.error.message
        }
      })
      return sendJson(res, 502, { error: 'No se pudo cargar el catálogo.' })
    }

    return sendJson(res, 200, {
      actividades: activitiesResult.data || [],
      materiales: materialsResult.data || []
    })
  } catch {
    return sendJson(res, 500, { error: 'El servicio de catálogo no está configurado.' })
  }
}