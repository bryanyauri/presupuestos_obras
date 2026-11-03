import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateBudget } from '../server/calculation.js'
import { createQuotePdf } from '../server/pdf.js'
import { getQuoteCount, setQuoteCount } from '../server/quota.js'

test('el cálculo aplica reserva, redondeo, mano de obra e IGV en servidor', () => {
  const result = calculateBudget({
    areaMetrado: 10,
    porcentajeManoObra: 30,
    incluyeIGV: true,
    items: [{
      material_id: 1,
      material_nombre: 'Pintura',
      marca_referencia: 'Marca',
      material_unidad_compra: 'Galón',
      rendimiento_m2: 2,
      precio_referencial: 20
    }]
  })

  assert.equal(result.materiales[0].cantidadExacta, '5.50')
  assert.equal(result.materiales[0].cantidadComercial, 6)
  assert.equal(result.costoTotalMateriales, 120)
  assert.equal(result.costoManoObra, 36)
  assert.equal(result.montoIGV, 28.08)
  assert.equal(result.costoPresupuestoTotal, 184.08)
})

test('el backend rechaza valores de cálculo fuera del rango permitido', () => {
  assert.throws(() => calculateBudget({
    areaMetrado: -5,
    porcentajeManoObra: 30,
    items: []
  }), /metrado no es válido/i)
})

test('la cuota firmada se lee y una cookie manipulada se invalida', () => {
  process.env.QUOTE_COOKIE_SECRET = 'test-secret-with-more-than-thirty-two-characters'
  const responseHeaders = {}
  setQuoteCount({ setHeader: (name, value) => { responseHeaders[name] = value } }, 4)

  const cookie = responseHeaders['Set-Cookie'].split(';')[0]
  assert.equal(getQuoteCount({ headers: { cookie } }), 4)

  const [name, value] = cookie.split('=')
  const changedValue = `${value.slice(0, -1)}${value.endsWith('a') ? 'b' : 'a'}`
  assert.equal(getQuoteCount({ headers: { cookie: `${name}=${changedValue}` } }), 0)
})

test('el servidor genera un PDF con nombre seguro', () => {
  const input = {
    areaMetrado: 10,
    porcentajeManoObra: 30,
    incluyeIGV: true,
    incluyeHerramientas: true,
    incluyeLimpieza: false,
    activity: { nombre: 'Pintura', categoria: 'Acabados', unidad_medida: 'm2' },
    cliente: 'Cliente de prueba',
    proyecto: '',
    validezDias: 15,
    items: [{
      material_id: 1,
      material_nombre: 'Pintura',
      marca_referencia: 'Marca',
      material_unidad_compra: 'Galón',
      rendimiento_m2: 2,
      precio_referencial: 20
    }]
  }
  const result = createQuotePdf(input, calculateBudget(input))

  assert.ok(Buffer.isBuffer(result.buffer))
  assert.ok(result.buffer.length > 1000)
  assert.equal(result.filename, 'Presupuesto_Pintura_10m2.pdf')
})