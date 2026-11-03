const numberInRange = (value, label, min, max) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} no es válido.`)
  }
  return parsed
}

const cleanText = (value, label, maxLength, fallback = '') => {
  if (typeof value !== 'string') return fallback
  const text = value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ')
  if (text.length > maxLength) throw new Error(`${label} es demasiado largo.`)
  return text || fallback
}

const roundCurrency = (value) => Math.round((value + Number.EPSILON) * 100) / 100

export const calculateBudget = (input) => {
  const areaMetrado = numberInRange(input.areaMetrado, 'El metrado', 0, 1000000)
  const porcentajeManoObra = numberInRange(input.porcentajeManoObra, 'El porcentaje de mano de obra', 0, 200)
  const incluyeIGV = input.incluyeIGV === true

  if (!Array.isArray(input.items) || input.items.length > 200) {
    throw new Error('La lista de insumos no es válida.')
  }

  const materiales = input.items.map((item) => {
    const materialNombre = cleanText(item.material_nombre, 'El nombre del insumo', 160)
    if (!materialNombre) throw new Error('Cada insumo debe tener un nombre.')

    const rendimiento = numberInRange(item.rendimiento_m2, 'El rendimiento', 0.01, 1000000)
    const precio = numberInRange(item.precio_referencial, 'El precio', 0, 100000000)
    const cantidadExacta = areaMetrado / rendimiento * 1.1
    const cantidadComercial = areaMetrado > 0 ? Math.ceil(cantidadExacta) : 0

    return {
      material_id: String(item.material_id ?? ''),
      material_nombre: materialNombre,
      marca_referencia: cleanText(item.marca_referencia, 'La marca', 100, 'Comercial'),
      material_unidad_compra: cleanText(item.material_unidad_compra, 'La unidad', 40, 'Unidad'),
      rendimiento_m2: rendimiento,
      precio_referencial: precio,
      consumoUnitario: (1 / rendimiento).toFixed(4),
      cantidadExacta: cantidadExacta.toFixed(2),
      cantidadComercial,
      costoSubtotal: roundCurrency(cantidadComercial * precio)
    }
  })

  const costoTotalMateriales = roundCurrency(materiales.reduce((total, item) => total + item.costoSubtotal, 0))
  const costoManoObra = roundCurrency(costoTotalMateriales * (porcentajeManoObra / 100))
  const subtotalSinIGV = roundCurrency(costoTotalMateriales + costoManoObra)
  const montoIGV = incluyeIGV ? roundCurrency(subtotalSinIGV * 0.18) : 0

  return {
    areaMetrado,
    porcentajeManoObra,
    incluyeIGV,
    materiales,
    costoTotalMateriales,
    costoManoObra,
    subtotalSinIGV,
    montoIGV,
    costoPresupuestoTotal: roundCurrency(subtotalSinIGV + montoIGV)
  }
}

export const cleanPdfText = (value, label, maxLength, fallback = '') =>
  cleanText(value, label, maxLength, fallback).replace(/[\r\n]+/g, ' ')