/**
 * Motor de respuesta local (sin IA) para el chat conversacional.
 * Se usa cuando no hay GEMINI_API_KEY o la llamada al modelo falla,
 * para que el asistente nunca deje de responder.
 */
export interface InventarioItem {
  claseEquipo: string;
  tipoEquipo: string;
  saldoActual: number;
  umbralMinimo: number;
  ancho: number;
  largo: number;
  profundidad: number;
  volumenTotalM3: number;
  estadoEquipo: string;
}

export interface MovimientoResumen {
  codigoLote: string;
  fecha: string;
  tipoMovimiento: string;
  claseEquipo: string;
  cantidad: number;
  procedenciaDestino: string;
  responsable: string;
  saldoResultante: number;
}

const stripAccents = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function generateSmartLocalChatReply(
  userQuery: string,
  items: InventarioItem[],
  recentMoves: MovimientoResumen[],
  totalMovs: number
): string {
  const q = stripAccents(userQuery);
  const totalUnits = items.reduce((acc, i) => acc + Math.max(0, i.saldoActual), 0);
  const totalVolumeM3 = items.reduce((acc, i) => acc + i.volumenTotalM3, 0);
  const lowStockItems = items.filter((i) => i.saldoActual <= i.umbralMinimo);

  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|que tal|hi|hello)/i.test(q)) {
    let greeting = `Hola, con gusto te ayudo. En este momento tenemos registradas ${totalUnits} unidades físicas en patio, con un volumen total de ${totalVolumeM3.toFixed(2)} m³ distribuidas en ${items.length} referencias estructurales.`;
    greeting += lowStockItems.length > 0
      ? `\n\nTenemos ${lowStockItems.length} referencia(s) que han alcanzado su umbral mínimo de seguridad y requieren atención.`
      : `\n\nTodos los niveles de inventario se encuentran estables sobre los umbrales mínimos establecidos.`;
    greeting += `\n\nPuedes preguntarme por el stock de una pieza específica, solicitar un reporte de piezas críticas, revisar los últimos movimientos o pedirme ayuda para registrar por voz. ¿En qué te gustaría enfocarte?`;
    return greeting;
  }

  if (q.includes("stock") || q.includes("existencia") || q.includes("resumen") || q.includes("patio") || q.includes("cuanto hay") || q.includes("cuantas") || q.includes("inventario") || q.includes("m3") || q.includes("volumen")) {
    const matchedPiece = items.find(
      (i) => q.includes(stripAccents(i.claseEquipo)) || q.includes(stripAccents(i.tipoEquipo))
    );

    if (matchedPiece) {
      const isLow = matchedPiece.saldoActual <= matchedPiece.umbralMinimo;
      let reply = `Para ${matchedPiece.claseEquipo} (${matchedPiece.tipoEquipo}) disponemos de ${matchedPiece.saldoActual} unidades en patio, con un volumen total almacenado de ${matchedPiece.volumenTotalM3.toFixed(3)} m³.\n\n`;
      reply += `Sus dimensiones son ${matchedPiece.ancho} cm de ancho, ${matchedPiece.largo} cm de largo y ${matchedPiece.profundidad} cm de profundidad. El estado reportado es ${matchedPiece.estadoEquipo}.\n\n`;
      reply += isLow
        ? `Ten presente que el saldo actual está en o por debajo de su umbral mínimo (${matchedPiece.umbralMinimo} unidades), por lo que se sugiere programar una reposición.`
        : `El saldo se encuentra en nivel óptimo frente a su umbral mínimo de ${matchedPiece.umbralMinimo} unidades.`;
      return reply;
    }

    let summary = `En el patio de Sedimec contamos con un total de ${totalUnits} unidades y un cubicaje global de ${totalVolumeM3.toFixed(2)} m³ distribuidos de la siguiente manera:\n\n`;
    items.forEach((item) => {
      const alertText = item.saldoActual <= item.umbralMinimo ? " (nivel crítico)" : "";
      summary += `• ${item.claseEquipo}: ${item.saldoActual} unidades disponibles, ${item.volumenTotalM3.toFixed(2)} m³${alertText}.\n`;
    });
    summary += `\nSi necesitas consultar o gestionar alguna pieza en particular, sólo indícame su nombre.`;
    return summary;
  }

  if (q.includes("critico") || q.includes("umbral") || q.includes("alerta") || q.includes("agotado") || q.includes("bajo stock") || q.includes("minimo")) {
    if (lowStockItems.length === 0) {
      return `Buenas noticias: actualmente ninguna referencia está por debajo de su umbral mínimo de seguridad. Todas las piezas cuentan con existencias suficientes en patio.`;
    }
    let alertMsg = `Actualmente hay ${lowStockItems.length} referencia(s) que requieren atención por estar en o por debajo de su nivel mínimo:\n\n`;
    lowStockItems.forEach((item) => {
      alertMsg += `• ${item.claseEquipo}: quedan ${item.saldoActual} unidades disponibles (umbral mínimo configurado: ${item.umbralMinimo} unidades).\n`;
    });
    alertMsg += `\nTe recomiendo coordinar con compras o emitir una solicitud de recepción a proveedores. También puedes ajustar estos umbrales desde el botón Umbrales y Alertas en el menú.`;
    return alertMsg;
  }

  if (q.includes("movimiento") || q.includes("reciente") || q.includes("historial") || q.includes("entradas") || q.includes("salidas") || q.includes("despacho") || q.includes("llegada")) {
    let movesText = `Se han registrado ${totalMovs} transacciones en el historial. Los movimientos más recientes son:\n\n`;
    recentMoves.slice(0, 4).forEach((m) => {
      movesText += `• Lote ${m.codigoLote} (${m.fecha}): ${m.tipoMovimiento} de ${m.cantidad} unidades de ${m.claseEquipo}. Procedencia o destino: ${m.procedenciaDestino}. Responsable: ${m.responsable}. Saldo resultante: ${m.saldoResultante} unidades.\n`;
    });
    movesText += `\nPuedes consultar el historial completo y descargar el reporte en Excel desde la pestaña de Movimientos.`;
    return movesText;
  }

  if (q.includes("voz") || q.includes("dictar") || q.includes("grabar") || q.includes("asistente") || q.includes("microfono") || q.includes("como funciona")) {
    return `Para registrar un movimiento por voz, solo pulsa el botón del micrófono en la barra superior o en el menú lateral y dicta lo sucedido con tus propias palabras.\n\nPor ejemplo puedes decir: "Llegaron 25 vigas IPE 300 de 15 por 600 por 30 centímetros en buen estado de Siderúrgica del Norte entregó Carlos Ruiz".\n\nEl sistema organizará los datos automáticamente en el formulario para que puedas revisarlos y confirmar el registro con un solo clic.`;
  }

  if (q.includes("integridad") || q.includes("conciliacion") || q.includes("balance") || q.includes("descuadre") || q.includes("regla")) {
    return `El inventario se recalcula siempre desde el libro de movimientos, así que no puede desincronizarse. Aun así puedes presionar el botón de Auditoría en el menú lateral para ejecutar una comprobación formal de las 6 reglas de integridad en cualquier momento.`;
  }

  return `Consulté el sistema en tiempo real para tu consulta. Actualmente tenemos ${totalUnits} unidades físicas en patio con un volumen de ${totalVolumeM3.toFixed(2)} m³ y ${totalMovs} transacciones registradas. ${lowStockItems.length > 0 ? `Hay ${lowStockItems.length} alerta(s) de stock bajo activas.` : "Los niveles de inventario están estables."} ¿Deseas consultar el stock de alguna pieza específica o revisar los últimos movimientos?`;
}
