import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { cleanPdfText } from './calculation.js'

export const createQuotePdf = (input, budget) => {
  const activity = input.activity || {}
  const activityName = cleanPdfText(activity.nombre, 'La partida', 120, 'Partida personalizada')
  const activityCategory = cleanPdfText(activity.categoria, 'La categoría', 80, 'Personalizado')
  const unit = cleanPdfText(activity.unidad_medida, 'La unidad de metrado', 20, 'm2')
  const client = cleanPdfText(input.cliente, 'El cliente', 120, 'Consumidor Final')
  const project = cleanPdfText(input.proyecto, 'El proyecto', 160)
  const validity = Number(input.validezDias)

  if (!Number.isInteger(validity) || validity < 1 || validity > 365) {
    throw new Error('La validez debe estar entre 1 y 365 días.')
  }

  const doc = new jsPDF()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, 210, 26, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text('Calculadora de Presupuestos de Acabados', 14, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text('Presupuesto técnico estimado para acabados de obra', 14, 20)
  doc.text(`Emisión: ${new Date().toLocaleDateString('es-PE')}`, 196, 17, { align: 'right' })

  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(14, 30, 182, 16, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(`${activityName} - ${budget.areaMetrado} ${unit}`, 18, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  const projectText = project ? ` • Proyecto: ${project}` : ''
  doc.text(`Cliente: ${client}${projectText} • Validez: ${validity} días`, 18, 43)

  doc.setFillColor(239, 246, 255)
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(14, 50, 58, 20, 2, 2, 'FD')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175)
  doc.text('Total Materiales:', 18, 56)
  doc.setFontSize(11)
  doc.text(`S/ ${budget.costoTotalMateriales.toFixed(2)}`, 18, 65)

  doc.setFillColor(239, 246, 255)
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(76, 50, 58, 20, 2, 2, 'FD')
  doc.setFontSize(7.5)
  doc.setTextColor(30, 64, 175)
  doc.text(`Mano de obra (${budget.porcentajeManoObra}%):`, 80, 56)
  doc.setFontSize(11)
  doc.text(`S/ ${budget.costoManoObra.toFixed(2)}`, 80, 65)

  doc.setFillColor(30, 58, 138)
  doc.roundedRect(138, 50, 58, 20, 2, 2, 'F')
  doc.setFontSize(7.5)
  doc.setTextColor(219, 234, 254)
  doc.text(budget.incluyeIGV ? 'TOTAL ESTIMADO (C/ IGV):' : 'TOTAL ESTIMADO:', 142, 56)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(`S/ ${budget.costoPresupuestoTotal.toFixed(2)}`, 142, 65)

  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text('Detalle de Materiales Requeridos', 14, 78)
  const rows = budget.materiales.map((item) => [
    { content: item.material_nombre, styles: { fontStyle: 'bold' } },
    { content: item.marca_referencia, styles: { fontStyle: 'italic', textColor: [71, 85, 105] } },
    { content: `${item.cantidadComercial} ${item.material_unidad_compra}`, styles: { halign: 'center', fontStyle: 'bold' } },
    { content: `S/ ${item.costoSubtotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138] } }
  ])

  autoTable(doc, {
    startY: 82,
    margin: { left: 13, right: 13 },
    head: [['MATERIAL', 'MARCA REF.', 'CANTIDAD', 'TOTAL (S/)']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 8.5, halign: 'left', lineWidth: 0.2, lineColor: [226, 232, 240] },
    bodyStyles: { fontSize: 8.5, textColor: [15, 23, 42], lineWidth: 0.2, lineColor: [226, 232, 240], cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 42 }, 2: { cellWidth: 32 }, 3: { cellWidth: 28 } }
  })

  const yAddons = doc.lastAutoTable.finalY + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text('Servicios Adicionales y Condiciones', 14, yAddons)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(51, 65, 85)
  const tools = input.incluyeHerramientas ? '[X] Incluye herramientas' : '[  ] No incluye herramientas'
  const cleaning = input.incluyeLimpieza ? '[X] Incluye limpieza final' : '[  ] No incluye limpieza final'
  const tax = budget.incluyeIGV ? `[X] Incluye IGV (18% = S/ ${budget.montoIGV.toFixed(2)})` : '[  ] No incluye IGV'
  doc.text(`${tools}        ${cleaning}        ${tax}`, 14, yAddons + 6)
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Cantidades comerciales completas. Precios de referencia de mercado.', 14, 285)

  const safeUnit = unit.replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = `Presupuesto_${activityName.replace(/[^a-zA-Z0-9]/g, '_')}_${budget.areaMetrado}${safeUnit}.pdf`
  return { buffer: Buffer.from(doc.output('arraybuffer')), filename }
}