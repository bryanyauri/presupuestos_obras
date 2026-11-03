<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getJson, postForBlob, postJson } from './api'

const LIMITE_PDF_MENSUAL = 10

// Estados principales
const actividades = ref([])
const todosMateriales = ref([])
const actividadSeleccionada = ref(null)
const materialesPartida = ref([])
const areaMetrado = ref(10)
const porcentajeManoObra = ref(40)

// Opciones de Servicios Adicionales (Chips)
const incluyeHerramientas = ref(true)
const incluyeLimpieza = ref(true)
const incluyeIGV = ref(false)

// Estado del servidor
const descargasRestantes = ref(LIMITE_PDF_MENSUAL)
const presupuesto = ref({
  materiales: [],
  costoTotalMateriales: 0,
  costoManoObra: 0,
  subtotalSinIGV: 0,
  montoIGV: 0,
  costoPresupuestoTotal: 0
})
const generandoPDF = ref(false)
const mostrarModalLimite = ref(false)
const cargando = ref(false)
const errorMsg = ref('')

// Estados de modales
const mostrarModalAgregarMaterial = ref(false)
const mostrarModalNuevaActividad = ref(false)
const mostrarModalPDF = ref(false)
const mostrarModalComentario = ref(false)
const tipoComentario = ref('sugerencia')
const textoComentario = ref('')
const enviandoComentario = ref(false)
const comentarioEnviado = ref(false)
const errorComentario = ref('')

// Formulario para nueva actividad
const nuevaActividadForm = ref({
  nombre: '',
  categoria: 'Acabados Varios',
  unidad_medida: 'm2'
})

// Datos del presupuesto para el PDF
const datosPDF = ref({
  cliente: '',
  proyecto: '',
  validezDias: 15
})

// Formulario para nuevo insumo
const nuevoMaterial = ref({
  material_id: '',
  nombre: '',
  marca_referencia: '',
  unidad: 'Unidad',
  rendimiento_m2: 10,
  precio_referencial: 20
})

const calculoMateriales = computed(() => presupuesto.value.materiales)
const costoTotalMateriales = computed(() => presupuesto.value.costoTotalMateriales)
const costoManoObra = computed(() => presupuesto.value.costoManoObra)
const montoIGV = computed(() => presupuesto.value.montoIGV)
const costoPresupuestoTotal = computed(() => presupuesto.value.costoPresupuestoTotal)

const abrirModalComentario = () => {
  tipoComentario.value = 'sugerencia'
  textoComentario.value = ''
  comentarioEnviado.value = false
  errorComentario.value = ''
  mostrarModalComentario.value = true
}

const cerrarModalComentario = () => {
  mostrarModalComentario.value = false
  errorComentario.value = ''
}

const enviarComentario = async () => {
  const mensaje = textoComentario.value.trim()
  if (mensaje.length < 8 || mensaje.length > 1000) {
    errorComentario.value = 'Escribe un comentario de entre 8 y 1000 caracteres.'
    return
  }

  enviandoComentario.value = true
  errorComentario.value = ''

  try {
    await postJson('/api/comentarios', {
      tipo: tipoComentario.value,
      mensaje
    })
    comentarioEnviado.value = true
    textoComentario.value = ''
  } catch {
    errorComentario.value = 'No se pudo enviar. Inténtalo de nuevo más tarde.'
  } finally {
    enviandoComentario.value = false
  }
}

const cargarMateriales = async (idActividad) => {
  if (!idActividad) return
  if (typeof idActividad === 'number' && idActividad > 1000000000) return

  cargando.value = true
  errorMsg.value = ''
  try {
    const { materiales } = await getJson(`/api/plantilla?actividad_id=${encodeURIComponent(idActividad)}`)
    materialesPartida.value = materiales.map((item) => ({
      ...item,
      rendimiento_m2: Number(item.rendimiento_m2),
      precio_referencial: Number(item.precio_referencial)
    }))
  } catch (error) {
    errorMsg.value = error.message
    materialesPartida.value = []
  } finally {
    cargando.value = false
  }
}

const calcularPresupuesto = async () => {
  if (materialesPartida.value.length === 0) {
    presupuesto.value = {
      materiales: [],
      costoTotalMateriales: 0,
      costoManoObra: 0,
      subtotalSinIGV: 0,
      montoIGV: 0,
      costoPresupuestoTotal: 0
    }
    return
  }

  try {
    presupuesto.value = await postJson('/api/calcular', {
      areaMetrado: areaMetrado.value,
      porcentajeManoObra: porcentajeManoObra.value,
      incluyeIGV: incluyeIGV.value,
      items: materialesPartida.value
    })
  } catch (error) {
    errorMsg.value = error.message
  }
}

let calculationTimer
watch([areaMetrado, porcentajeManoObra, incluyeIGV, materialesPartida], () => {
  clearTimeout(calculationTimer)
  calculationTimer = setTimeout(calcularPresupuesto, 150)
}, { deep: true })

onMounted(async () => {
  cargando.value = true
  try {
    const [catalog, quota] = await Promise.all([
      getJson('/api/catalogo'),
      getJson('/api/estado')
    ])
    actividades.value = catalog.actividades
    todosMateriales.value = catalog.materiales
    descargasRestantes.value = quota.restantes
    if (actividades.value.length > 0) actividadSeleccionada.value = actividades.value[0].id
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    cargando.value = false
  }
})

watch(actividadSeleccionada, (nuevoId) => cargarMateriales(nuevoId))

const actividadActual = computed(() => {
  return actividades.value.find((a) => a.id === actividadSeleccionada.value) || { 
    nombre: 'Partida Personalizada', 
    categoria: 'Personalizado',
    unidad_medida: 'm2' 
  }
})

const eliminarMaterial = (index) => {
  materialesPartida.value.splice(index, 1)
}

const abrirModalAgregarMaterial = () => {
  nuevoMaterial.value = {
    material_id: '',
    nombre: '',
    marca_referencia: 'Comercial',
    unidad: 'Unidad',
    rendimiento_m2: 10,
    precio_referencial: 20
  }
  mostrarModalAgregarMaterial.value = true
}

const seleccionarMaterialCatalogo = () => {
  const mat = todosMateriales.value.find((m) => m.id === nuevoMaterial.value.material_id)
  if (mat) {
    nuevoMaterial.value.nombre = mat.nombre
    nuevoMaterial.value.marca_referencia = mat.marca_referencia || 'Comercial'
    nuevoMaterial.value.unidad = mat.unidad_medida
    nuevoMaterial.value.precio_referencial = Number(mat.precio_referencial)
  }
}

const agregarMaterialAPartida = () => {
  if (!nuevoMaterial.value.nombre) return

  materialesPartida.value.push({
    material_id: nuevoMaterial.value.material_id || Date.now(),
    material_nombre: nuevoMaterial.value.nombre,
    marca_referencia: nuevoMaterial.value.marca_referencia || 'Comercial',
    material_unidad_compra: nuevoMaterial.value.unidad,
    rendimiento_m2: Number(nuevoMaterial.value.rendimiento_m2) || 1,
    precio_referencial: Number(nuevoMaterial.value.precio_referencial) || 0
  })

  mostrarModalAgregarMaterial.value = false
}

const abrirModalNuevaActividad = () => {
  nuevaActividadForm.value = {
    nombre: '',
    categoria: 'Acabados Varios',
    unidad_medida: 'm2'
  }
  mostrarModalNuevaActividad.value = true
}

const crearNuevaActividad = () => {
  if (!nuevaActividadForm.value.nombre.trim()) return

  const nuevoId = Date.now()
  const nuevaAct = {
    id: nuevoId,
    nombre: nuevaActividadForm.value.nombre.trim(),
    categoria: nuevaActividadForm.value.categoria.trim() || 'General',
    unidad_medida: nuevaActividadForm.value.unidad_medida || 'm2'
  }

  actividades.value.unshift(nuevaAct)
  materialesPartida.value = []
  actividadSeleccionada.value = nuevoId
  mostrarModalNuevaActividad.value = false
}

const intentarAbrirModalPDF = () => {
  if (descargasRestantes.value <= 0) {
    mostrarModalLimite.value = true
  } else {
    mostrarModalPDF.value = true
  }
}

const ejecutarDescargaPDF = async () => {
  if (descargasRestantes.value <= 0) {
    mostrarModalPDF.value = false
    mostrarModalLimite.value = true
    return
  }

  generandoPDF.value = true
  errorMsg.value = ''
  try {
    const result = await postForBlob('/api/cotizacion', {
      areaMetrado: areaMetrado.value,
      porcentajeManoObra: porcentajeManoObra.value,
      incluyeIGV: incluyeIGV.value,
      incluyeHerramientas: incluyeHerramientas.value,
      incluyeLimpieza: incluyeLimpieza.value,
      items: materialesPartida.value,
      activity: actividadActual.value,
      cliente: datosPDF.value.cliente,
      proyecto: datosPDF.value.proyecto,
      validezDias: datosPDF.value.validezDias
    })
    const downloadUrl = URL.createObjectURL(result.blob)
    const downloadLink = document.createElement('a')
    downloadLink.href = downloadUrl
    downloadLink.download = result.filename
    downloadLink.click()
    URL.revokeObjectURL(downloadUrl)
    descargasRestantes.value = result.remaining
    mostrarModalPDF.value = false
  } catch (error) {
    errorMsg.value = error.message
    if (error.message.includes('límite mensual')) {
      descargasRestantes.value = 0
      mostrarModalPDF.value = false
      mostrarModalLimite.value = true
    }
  } finally {
    generandoPDF.value = false
  }
}
</script>

<template>
  <main class="page-container">
    <div class="card-wrapper">
      
      <!-- Encabezado Principal -->
      <header class="app-header">
        <div class="header-info">
          <h1 class="header-title">Calculadora de Acabados</h1>
          <div class="header-meta">
            <span class="meta-tag">Cantidades comerciales</span>
            <span class="meta-dot">•</span>
            <span class="badge-quota" :class="descargasRestantes > 3 ? 'quota-ok' : 'quota-low'">
              {{ descargasRestantes }}/{{ LIMITE_PDF_MENSUAL }} disponibles
            </span>
          </div>
        </div>
        
        <div class="header-actions">
          <button @click="abrirModalComentario" class="btn-feedback">
            Enviar sugerencia
          </button>
          <button @click="intentarAbrirModalPDF" class="btn-pdf-desktop" :disabled="generandoPDF">
            <span>📄</span> {{ generandoPDF ? 'Generando...' : 'Descargar Cotización PDF' }}
          </button>
        </div>
      </header>

      <div v-if="errorMsg" class="alert-error">
        {{ errorMsg }}
      </div>

      <!-- Tarjetas KPI Superiores (Resumen) -->
      <section class="kpi-banner">
        <div class="kpi-box">
          <span class="kpi-label">Materiales</span>
          <strong class="kpi-value">S/ {{ costoTotalMateriales.toFixed(2) }}</strong>
        </div>
        <div class="kpi-box">
          <span class="kpi-label">Mano de Obra ({{ porcentajeManoObra }}%)</span>
          <strong class="kpi-value">S/ {{ costoManoObra.toFixed(2) }}</strong>
        </div>
        <div class="kpi-box kpi-highlight">
          <span class="kpi-label-highlight">{{ incluyeIGV ? 'TOTAL C/ IGV' : 'TOTAL ESTIMADO' }}</span>
          <strong class="kpi-value-highlight">S/ {{ costoPresupuestoTotal.toFixed(2) }}</strong>
        </div>
      </section>

      <!-- Panel de Controles -->
      <section class="controls-panel">
        <div class="form-group-partida">
          <div class="label-row">
            <label class="field-label">Partida / Actividad:</label>
            <button @click="abrirModalNuevaActividad" class="btn-xs-action">+ Nueva</button>
          </div>
          <select v-model="actividadSeleccionada" class="form-select">
            <option v-for="act in actividades" :key="act.id" :value="act.id">
              {{ act.nombre }} ({{ act.categoria }})
            </option>
          </select>
        </div>

        <div class="row-inputs-responsive">
          <div class="form-group-metrado">
            <label class="field-label">Metrado ({{ actividadActual.unidad_medida || 'm²' }}):</label>
            <input 
              v-model.number="areaMetrado" 
              type="number" 
              min="0.1" 
              step="0.5" 
              class="form-input text-blue"
            />
          </div>

          <div class="form-group-mo">
            <label class="field-label">% Mano de Obra:</label>
            <div class="mo-controls-wrapper">
              <input 
                v-model.number="porcentajeManoObra" 
                type="number" 
                min="0" 
                max="200" 
                class="form-input mo-input"
              />
              <div class="mo-chips">
                <button @click="porcentajeManoObra = 30" class="chip-btn" :class="{ 'chip-active': porcentajeManoObra === 30 }">30%</button>
                <button @click="porcentajeManoObra = 40" class="chip-btn" :class="{ 'chip-active': porcentajeManoObra === 40 }">40%</button>
                <button @click="porcentajeManoObra = 50" class="chip-btn" :class="{ 'chip-active': porcentajeManoObra === 50 }">50%</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Servicios Adicionales en Chips Táctiles -->
        <div class="addons-section">
          <span class="addons-label">Servicios:</span>
          <div class="addons-chips-list">
            <label class="toggle-chip" :class="{ 'toggle-active': incluyeHerramientas }">
              <input type="checkbox" v-model="incluyeHerramientas" class="chip-checkbox" />
              Herramientas
            </label>
            <label class="toggle-chip" :class="{ 'toggle-active': incluyeLimpieza }">
              <input type="checkbox" v-model="incluyeLimpieza" class="chip-checkbox" />
              Limpieza
            </label>
            <label class="toggle-chip" :class="{ 'toggle-active': incluyeIGV }">
              <input type="checkbox" v-model="incluyeIGV" class="chip-checkbox" />
              IGV (18%)
            </label>
          </div>
        </div>
      </section>

      <!-- Barra de Insumos -->
      <div class="materials-bar">
        <span class="materials-title">
          Insumos: <strong>{{ actividadActual.nombre }}</strong>
        </span>
        <button @click="abrirModalAgregarMaterial" class="btn-add-item">
          + Insumo
        </button>
      </div>

      <div v-if="cargando" class="state-loading">
        Cargando insumos...
      </div>

      <!-- VISTA TABULAR (Solo Desktop) -->
      <div v-else-if="calculoMateriales.length > 0" class="desktop-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th>Insumo / Marca Referencial</th>
              <th class="th-center">Rendimiento</th>
              <th class="th-right">Cálculo</th>
              <th class="th-center th-dark">A Comprar (Ferretería)</th>
              <th class="th-right">P. Ref (S/)</th>
              <th class="th-right">Subtotal (S/)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in calculoMateriales" :key="item.material_id">
              <td>
                <div class="table-mat-name">{{ item.material_nombre }}</div>
                <div class="table-mat-brand">🏷️ {{ item.marca_referencia || 'Comercial' }}</div>
              </td>
              <td class="td-center">
                <input 
                  v-model.number="materialesPartida[index].rendimiento_m2" 
                  type="number" 
                  step="0.1" 
                  min="0.01" 
                  class="table-input-center"
                />
              </td>
              <td class="td-right table-muted">{{ item.cantidadExacta }}</td>
              <td class="td-center td-blue">
                {{ item.cantidadComercial }} {{ item.material_unidad_compra }}
              </td>
              <td class="td-right">
                <div class="table-price-flex">
                  <span class="currency-label">S/</span>
                  <input 
                    v-model.number="materialesPartida[index].precio_referencial" 
                    type="number" 
                    step="0.5" 
                    min="0" 
                    class="table-input-right"
                  />
                </div>
              </td>
              <td class="td-right table-bold">S/ {{ item.costoSubtotal.toFixed(2) }}</td>
              <td class="td-center">
                <button @click="eliminarMaterial(index)" class="btn-remove-row">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- VISTA TARJETAS (Solo Móvil) -->
      <div v-if="!cargando && calculoMateriales.length > 0" class="mobile-cards-container">
        <article 
          v-for="(item, index) in calculoMateriales" 
          :key="'card-' + item.material_id" 
          class="item-card"
        >
          <div class="card-top-row">
            <div class="card-title-group">
              <h3 class="card-title">{{ item.material_nombre }}</h3>
              <span class="card-brand">🏷️ {{ item.marca_referencia || 'Comercial' }}</span>
            </div>
            <button @click="eliminarMaterial(index)" class="card-btn-delete" title="Quitar">✕</button>
          </div>

          <div class="card-purchase-banner">
            <div class="purchase-item">
              <span class="purchase-caption">A Comprar:</span>
              <strong class="purchase-qty">{{ item.cantidadComercial }} {{ item.material_unidad_compra }}</strong>
            </div>
            <div class="purchase-item item-right">
              <span class="purchase-caption">Subtotal:</span>
              <strong class="purchase-amount">S/ {{ item.costoSubtotal.toFixed(2) }}</strong>
            </div>
          </div>

          <div class="card-fields-grid">
            <div class="field-item">
              <label class="field-caption">Rinde ({{ actividadActual.unidad_medida || 'm²' }}):</label>
              <input 
                v-model.number="materialesPartida[index].rendimiento_m2" 
                type="number" 
                step="0.1" 
                min="0.01" 
                class="field-input"
              />
            </div>
            <div class="field-item">
              <label class="field-caption">P. Ref (S/):</label>
              <input 
                v-model.number="materialesPartida[index].precio_referencial" 
                type="number" 
                step="0.5" 
                min="0" 
                class="field-input"
              />
            </div>
            <div class="field-item">
              <label class="field-caption">Cálculo (+10%):</label>
              <div class="field-static">{{ item.cantidadExacta }}</div>
            </div>
          </div>
        </article>
      </div>

      <!-- Resumen en Desktop (Footer) -->
      <footer v-if="!cargando && calculoMateriales.length > 0" class="desktop-summary-card">
        <div class="summary-wrapper">
          <div class="summary-line">
            <span>Subtotal Materiales:</span>
            <strong>S/ {{ costoTotalMateriales.toFixed(2) }}</strong>
          </div>
          <div class="summary-line summary-mo">
            <span>Mano de Obra ({{ porcentajeManoObra }}%):</span>
            <strong>S/ {{ costoManoObra.toFixed(2) }}</strong>
          </div>
          <div v-if="incluyeIGV" class="summary-line summary-igv">
            <span>IGV (18%):</span>
            <strong>S/ {{ montoIGV.toFixed(2) }}</strong>
          </div>
          <div class="summary-total-line">
            <span>PRESUPUESTO TOTAL:</span>
            <span>S/ {{ costoPresupuestoTotal.toFixed(2) }}</span>
          </div>
        </div>
      </footer>

    </div>

    <!-- Barra Inferior Fija para Móviles -->
    <nav class="mobile-bottom-bar">
      <div class="bottom-total-info">
        <span class="bottom-label">{{ incluyeIGV ? 'Total (c/ IGV):' : 'Total Estimado:' }}</span>
        <strong class="bottom-price">S/ {{ costoPresupuestoTotal.toFixed(2) }}</strong>
      </div>
      <button @click="intentarAbrirModalPDF" class="btn-bottom-pdf" :disabled="generandoPDF">
        <span>📄</span> {{ generandoPDF ? '...' : 'PDF' }}
      </button>
    </nav>

    <!-- Modales -->
    <div v-if="mostrarModalNuevaActividad" class="modal-backdrop">
      <div class="modal-dialog">
        <h2 class="dialog-title">Crear Nueva Partida de Obra</h2>
        <div class="dialog-form">
          <div class="dialog-field">
            <label class="field-label">Nombre de la Partida:</label>
            <input v-model="nuevaActividadForm.nombre" type="text" placeholder="Ej: Tarrajeo con aditivo" class="form-input" />
          </div>
          <div class="dialog-row-2">
            <div class="dialog-field">
              <label class="field-label">Categoría:</label>
              <input v-model="nuevaActividadForm.categoria" type="text" placeholder="Ej: Albañilería" class="form-input" />
            </div>
            <div class="dialog-field">
              <label class="field-label">Unidad:</label>
              <select v-model="nuevaActividadForm.unidad_medida" class="form-select">
                <option value="m2">m²</option>
                <option value="m">m (lineal)</option>
                <option value="und">und</option>
                <option value="gl">gl (global)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="mostrarModalNuevaActividad = false" class="btn-dialog-cancel">Cancelar</button>
          <button @click="crearNuevaActividad" class="btn-dialog-submit">Crear Partida</button>
        </div>
      </div>
    </div>

    <div v-if="mostrarModalAgregarMaterial" class="modal-backdrop">
      <div class="modal-dialog">
        <h2 class="dialog-title">Agregar Insumo a la Partida</h2>
        <div class="dialog-form">
          <div class="dialog-field">
            <label class="field-label">Catálogo de Insumos:</label>
            <select v-model="nuevoMaterial.material_id" @change="seleccionarMaterialCatalogo" class="form-select">
              <option value="">-- Personalizado o nuevo --</option>
              <option v-for="m in todosMateriales" :key="m.id" :value="m.id">
                {{ m.nombre }} ({{ m.marca_referencia || 'Comercial' }})
              </option>
            </select>
          </div>
          <div class="dialog-field">
            <label class="field-label">Nombre del Insumo:</label>
            <input v-model="nuevoMaterial.nombre" type="text" placeholder="Ej: Sika 1 líquido" class="form-input" />
          </div>
          <div class="dialog-field">
            <label class="field-label">Marca de Referencia:</label>
            <input v-model="nuevoMaterial.marca_referencia" type="text" placeholder="Ej: Sika / Chema" class="form-input" />
          </div>
          <div class="dialog-row-3">
            <div class="dialog-field">
              <label class="field-label">Unidad:</label>
              <input v-model="nuevoMaterial.unidad" type="text" class="form-input" />
            </div>
            <div class="dialog-field">
              <label class="field-label">Rend. (m²/u):</label>
              <input v-model.number="nuevoMaterial.rendimiento_m2" type="number" step="0.1" min="0.01" class="form-input" />
            </div>
            <div class="dialog-field">
              <label class="field-label">P. Ref (S/):</label>
              <input v-model.number="nuevoMaterial.precio_referencial" type="number" step="0.5" min="0" class="form-input" />
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="mostrarModalAgregarMaterial = false" class="btn-dialog-cancel">Cancelar</button>
          <button @click="agregarMaterialAPartida" class="btn-dialog-submit">Agregar</button>
        </div>
      </div>
    </div>

    <div v-if="mostrarModalPDF" class="modal-backdrop">
      <div class="modal-dialog">
        <h2 class="dialog-title">Cotización Formal</h2>
        <p class="dialog-caption">Cupo: {{ descargasRestantes }} de {{ LIMITE_PDF_MENSUAL }} disponibles este mes.</p>
        <div class="dialog-form">
          <div class="dialog-field">
            <label class="field-label">Nombre del Cliente:</label>
            <input v-model="datosPDF.cliente" type="text" placeholder="Ej: Sr. Carlos Ramos" class="form-input" />
          </div>
          <div class="dialog-field">
            <label class="field-label">Proyecto / Dirección:</label>
            <input v-model="datosPDF.proyecto" type="text" placeholder="Ej: Dpto 302, Miraflores" class="form-input" />
          </div>
          <div class="dialog-field">
            <label class="field-label">Validez de oferta (días):</label>
            <input v-model.number="datosPDF.validezDias" type="number" min="1" class="form-input" />
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="mostrarModalPDF = false" class="btn-dialog-cancel">Cancelar</button>
          <button @click="ejecutarDescargaPDF" class="btn-dialog-download" :disabled="generandoPDF">
            {{ generandoPDF ? 'Generando...' : 'Descargar PDF' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="mostrarModalLimite" class="modal-backdrop">
      <div class="modal-dialog text-center">
        <div class="icon-limit">📋</div>
        <h2 class="dialog-title">Límite Alcanzado</h2>
        <p class="dialog-caption">Has completado las {{ LIMITE_PDF_MENSUAL }} cotizaciones gratuitas de este mes.</p>
        <button @click="mostrarModalLimite = false" class="btn-dialog-submit btn-block">Entendido</button>
      </div>
    </div>

    <div v-if="mostrarModalComentario" class="modal-backdrop" @click.self="cerrarModalComentario">
      <section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <button @click="cerrarModalComentario" class="feedback-close" type="button" aria-label="Cerrar">×</button>
        <template v-if="comentarioEnviado">
          <h2 id="feedback-title" class="dialog-title">¡Gracias por tu comentario!</h2>
          <p class="dialog-caption">Tu opinión nos ayudará a mejorar la aplicación.</p>
          <div class="dialog-actions">
            <button @click="cerrarModalComentario" class="btn-dialog-submit" type="button">Cerrar</button>
          </div>
        </template>
        <template v-else>
          <h2 id="feedback-title" class="dialog-title">Enviar comentario o sugerencia</h2>
          <p class="dialog-caption">Es anónimo. No incluyas nombres, direcciones ni datos de clientes.</p>
          <form class="dialog-form" @submit.prevent="enviarComentario">
            <div class="dialog-field">
              <label class="field-label" for="feedback-type">Tipo de comentario</label>
              <select id="feedback-type" v-model="tipoComentario" class="form-select">
                <option value="sugerencia">Sugerencia</option>
                <option value="problema">Reportar un problema</option>
                <option value="comentario">Comentario general</option>
              </select>
            </div>
            <div class="dialog-field">
              <label class="field-label" for="feedback-message">Tu comentario</label>
              <textarea
                id="feedback-message"
                v-model="textoComentario"
                class="feedback-textarea"
                rows="5"
                minlength="8"
                maxlength="1000"
                required
                placeholder="Cuéntanos qué podemos mejorar..."
              ></textarea>
              <span class="feedback-counter">{{ textoComentario.length }}/1000</span>
            </div>
            <p v-if="errorComentario" class="feedback-error" role="alert">{{ errorComentario }}</p>
            <div class="dialog-actions">
              <button @click="cerrarModalComentario" class="btn-dialog-cancel" type="button">Cancelar</button>
              <button class="btn-dialog-submit" type="submit" :disabled="enviandoComentario">
                {{ enviandoComentario ? 'Enviando...' : 'Enviar' }}
              </button>
            </div>
          </form>
        </template>
      </section>
    </div>

  </main>
</template>

<style scoped>
/* Reseteo y Base */
.page-container {
  padding: 16px;
  font-family: system-ui, -apple-system, sans-serif;
  background-color: #f1f5f9;
  min-height: 100vh;
  color: #1e293b;
  box-sizing: border-box;
}

.card-wrapper {
  max-width: 1100px;
  margin: 0 auto;
  background: #ffffff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
}

/* Encabezado */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 14px;
  margin-bottom: 18px;
  gap: 12px;
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.meta-dot {
  color: #cbd5e1;
}

.badge-quota {
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
}
.quota-ok {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.quota-low {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.btn-pdf-desktop {
  background: #047857;
  color: #ffffff;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-feedback {
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.btn-feedback:hover {
  background: #f8fafc;
}

/* Banner de KPIs */
.kpi-banner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}
.kpi-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}
.kpi-label {
  font-size: 11px;
  color: #1e40af;
  font-weight: 600;
}
.kpi-value {
  font-size: 16px;
  color: #1e3a8a;
  font-weight: 800;
}
.kpi-highlight {
  background: #1e3a8a;
  border-color: #1e3a8a;
}
.kpi-label-highlight {
  font-size: 11px;
  color: #bfdbfe;
  font-weight: 700;
}
.kpi-value-highlight {
  font-size: 16px;
  color: #ffffff;
  font-weight: 800;
}

/* Panel de Controles */
.controls-panel {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 18px;
}
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.field-label {
  font-weight: 600;
  font-size: 12px;
  color: #475569;
  display: block;
  margin-bottom: 4px;
}
.form-input, .form-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  font-size: 13px;
  box-sizing: border-box;
}
.text-blue {
  color: #2563eb;
  font-weight: 700;
}

.row-inputs-responsive {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 14px;
  margin-top: 12px;
}
.mo-controls-wrapper {
  display: flex;
  gap: 6px;
  align-items: center;
}
.mo-input {
  width: 65px;
  color: #d97706;
  font-weight: 700;
  text-align: center;
}
.mo-chips {
  display: flex;
  gap: 4px;
}
.chip-btn {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
  font-size: 11px;
  cursor: pointer;
  color: #475569;
}
.chip-active {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
  font-weight: 700;
}
.btn-xs-action {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

/* Servicios Adicionales (Chips) */
.addons-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #cbd5e1;
  flex-wrap: wrap;
}
.addons-label {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}
.addons-chips-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.toggle-chip {
  padding: 5px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 9999px;
  background: #ffffff;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.chip-checkbox {
  margin: 0;
}
.toggle-active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1e40af;
  font-weight: 600;
}

/* Título de Insumos */
.materials-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.materials-title {
  font-size: 13px;
  color: #334155;
}
.btn-add-item {
  background: #2563eb;
  color: #ffffff;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

/* Tabla Desktop */
.desktop-table-container {
  overflow-x: auto;
}
.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}
.items-table thead tr {
  background: #1e293b;
  color: #ffffff;
}
.items-table th {
  padding: 10px;
}
.th-center { text-align: center; }
.th-right { text-align: right; }
.th-dark { background: #0f172a; }
.items-table tbody tr {
  border-bottom: 1px solid #e2e8f0;
}
.items-table td {
  padding: 8px 10px;
}
.table-mat-name {
  font-weight: 600;
  color: #0f172a;
}
.table-mat-brand {
  display: inline-block;
  margin-top: 3px;
  font-size: 11px;
  color: #0369a1;
  background: #e0f2fe;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.table-input-center {
  width: 60px;
  padding: 4px;
  text-align: center;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.table-input-right {
  width: 65px;
  padding: 4px;
  text-align: right;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.td-center { text-align: center; }
.td-right { text-align: right; }
.td-blue {
  background: #f8fafc;
  font-weight: 800;
  color: #1e40af;
}
.table-price-flex {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.currency-label { font-size: 11px; color: #64748b; }
.btn-remove-row {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

/* Ocultar tarjetas móviles y barra inferior en Desktop */
.mobile-cards-container {
  display: none;
}
.mobile-bottom-bar {
  display: none;
}

/* Footer Desktop */
.desktop-summary-card {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.summary-wrapper {
  width: 380px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
}
.summary-line {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
  color: #475569;
}
.summary-mo { color: #b45309; }
.summary-igv { color: #0369a1; }
.summary-total-line {
  display: flex;
  justify-content: space-between;
  border-top: 2px solid #cbd5e1;
  padding-top: 8px;
  font-size: 15px;
  font-weight: 800;
  color: #047857;
}

/* Modales */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}
.modal-dialog {
  background: #ffffff;
  border-radius: 10px;
  width: 100%;
  max-width: 440px;
  padding: 22px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}
.dialog-title {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 6px 0;
}
.dialog-caption {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 14px 0;
}
.feedback-close {
  float: right;
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.feedback-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font: inherit;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}
.feedback-counter {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
  text-align: right;
}
.feedback-error {
  margin: 0;
  color: #b91c1c;
  font-size: 13px;
}
.btn-dialog-submit:disabled {
  cursor: wait;
  opacity: 0.65;
}
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dialog-row-2 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
}
.dialog-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.btn-dialog-cancel {
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.btn-dialog-submit {
  padding: 8px 16px;
  background: #0284c7;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.btn-dialog-download {
  padding: 8px 16px;
  background: #047857;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.alert-error {
  margin-bottom: 14px;
  padding: 10px;
  background: #fee2e2;
  color: #b91c1c;
  border-radius: 6px;
  font-size: 13px;
}
.state-loading {
  padding: 24px;
  text-align: center;
  color: #64748b;
}

/* ==============================================================================
   ADAPTACIÓN RESPONSIVA MÓVIL (PWA Mobile < 768px)
   ============================================================================== */
@media (max-width: 768px) {
  .page-container {
    padding: 8px;
    padding-bottom: 80px; /* Margen para no tapar contenido con la barra fija */
  }

  .card-wrapper {
    padding: 14px;
    border-radius: 8px;
  }

  .btn-pdf-desktop {
    display: none; /* Se oculta de arriba y pasa a la barra inferior */
  }

  .app-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .header-actions {
    width: 100%;
  }

  .btn-feedback {
    width: 100%;
  }

  /* KPIs móviles apilados */
  .kpi-banner {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .row-inputs-responsive {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  /* Ocultar tabla tradicional */
  .desktop-table-container {
    display: none;
  }

  /* Activar tarjetas móviles */
  .mobile-cards-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .item-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .card-top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
  }

  .card-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 3px 0;
  }

  .card-brand {
    font-size: 11px;
    color: #0369a1;
    background: #e0f2fe;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .card-btn-delete {
    background: #fee2e2;
    color: #dc2626;
    border: none;
    width: 26px;
    height: 26px;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
  }

  .card-purchase-banner {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .purchase-caption {
    display: block;
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 600;
  }

  .purchase-qty {
    font-size: 14px;
    color: #1e40af;
    font-weight: 800;
  }

  .purchase-amount {
    font-size: 14px;
    color: #047857;
    font-weight: 800;
  }

  .item-right {
    text-align: right;
  }

  .card-fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .field-caption {
    display: block;
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    margin-bottom: 3px;
  }

  .field-input {
    width: 100%;
    padding: 6px 4px;
    text-align: center;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    box-sizing: border-box;
  }

  .field-static {
    padding: 6px 4px;
    background: #f1f5f9;
    border-radius: 4px;
    text-align: center;
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }

  .desktop-summary-card {
    display: none;
  }

  /* Barra Inferior Fija para Móviles */
  .mobile-bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #0f172a;
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.15);
    z-index: 40;
  }

  .bottom-label {
    display: block;
    font-size: 11px;
    color: #94a3b8;
  }

  .bottom-price {
    font-size: 16px;
    color: #38bdf8;
    font-weight: 800;
  }

  .btn-bottom-pdf {
    background: #047857;
    color: #ffffff;
    border: none;
    padding: 9px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
}
</style>