import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";
import { generateWithFallback } from "../_shared/gemini.ts";
import { generateSmartLocalChatReply, InventarioItem, MovimientoResumen } from "../_shared/localChatEngine.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const caller = await authenticateCaller(req, ["admin", "operador", "auditor"]);
  if (isAuthError(caller)) return caller;
  const { supabase } = caller;

  try {
    const { message, history } = await req.json();
    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "Mensaje no proporcionado." }, 400);
    }

    const [{ data: itemsRaw }, { data: movesRaw }, { count: totalMovs }, { data: settings }] = await Promise.all([
      supabase
        .from("inventario_actual")
        .select(
          "claseEquipo:clase_equipo, tipoEquipo:tipo_equipo, saldoActual:saldo_actual, umbralMinimo:umbral_minimo, ancho, largo, profundidad, volumenTotalM3:volumen_total_m3, estadoEquipo:estado_equipo"
        ),
      supabase
        .from("movimientos")
        .select(
          "codigoLote:codigo_lote, fecha, tipoMovimiento:tipo_movimiento, claseEquipo:clase_equipo, cantidad, procedenciaDestino:procedencia_destino, responsable, saldoResultante:saldo_resultante"
        )
        .eq("anulado", false)
        .order("creado_en", { ascending: false })
        .limit(8),
      supabase.from("movimientos").select("id", { count: "exact", head: true }).eq("anulado", false),
      supabase.from("notification_settings").select("recipients").eq("id", 1).single(),
    ]);

    const items: InventarioItem[] = itemsRaw ?? [];
    const recentMoves: MovimientoResumen[] = movesRaw ?? [];
    const totalMovimientos = totalMovs ?? 0;

    const totalUnits = items.reduce((acc, i) => acc + Math.max(0, i.saldoActual), 0);
    const totalVolumeM3 = items.reduce((acc, i) => acc + i.volumenTotalM3, 0);
    const lowStockItems = items.filter((i) => i.saldoActual <= i.umbralMinimo);

    // Snapshot compacto (texto, no JSON) para minimizar tokens de entrada y
    // acelerar la respuesta -- el JSON completo se pasaba antes y era
    // innecesariamente pesado para lo que el modelo realmente necesita leer.
    const itemsCompact = items
      .map((i) => `${i.claseEquipo} (${i.tipoEquipo}): ${i.saldoActual} und, ${i.volumenTotalM3.toFixed(2)} m³, umbral mín ${i.umbralMinimo}${i.saldoActual <= i.umbralMinimo ? " [BAJO]" : ""}`)
      .join("\n");
    const movesCompact = recentMoves
      .map((m) => `${m.fecha.slice(0, 10)} ${m.tipoMovimiento} ${m.cantidad} und de ${m.claseEquipo} (lote ${m.codigoLote}, saldo resultante ${m.saldoResultante})`)
      .join("\n");

    const systemPrompt = `Eres el Agente Virtual de Sedimec S.A., un asistente conversacional para el sistema de control de inventario de patio (recepción y entrega de materiales estructurales, cubicaje en m³, alertas por correo y trazabilidad).

DATOS EN TIEMPO REAL (úsalos SOLO si el usuario pregunta algo relacionado con inventario, movimientos o alertas):
Resumen: ${items.length} referencias, ${totalUnits} unidades en patio, ${totalVolumeM3.toFixed(2)} m³ ocupados, ${lowStockItems.length} en alerta de stock bajo, ${totalMovimientos} movimientos históricos.
Existencias:
${itemsCompact || "(sin referencias registradas todavía)"}
Últimos movimientos:
${movesCompact || "(sin movimientos todavía)"}

REGLAS DE NEGOCIO:
1. Saldo = Σ Entradas − Σ Salidas. 2. Volumen (m³) = (Ancho×Largo×Profundidad cm / 1,000,000) × Cantidad. 3. Alerta automática por correo cuando el saldo llega al umbral mínimo. 4. Se puede dictar por voz. 5. Auditoría automática de integridad disponible en el menú.

INSTRUCCIONES DE RESPUESTA (muy importantes):
- Si el usuario solo saluda o hace conversación general (ej. "hola", "buenas", "gracias"), responde con un saludo breve y natural, preséntate en una frase como el asistente de Sedimec, y pregunta en qué puede ayudarte. NO le expongas cifras, listas ni resúmenes de inventario a menos que él las pida explícitamente.
- Responde SOLO lo que el usuario pidió. No agregues datos de inventario "por si acaso" a preguntas que no los requieren.
- Sé breve: 1-4 frases para la mayoría de respuestas; usa el detalle completo solo cuando el usuario pida explícitamente un resumen o listado.
- Español natural y humano. Prohibido usar ### / ## / LaTeX ($$). Si listas varias piezas, usa viñetas simples con guiones.
- Cuando sí uses los datos de arriba, que sean exactos.`;

    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h?.text) contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
      }
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    // Prioriza el modelo más ligero primero: el chat es conversacional e interactivo,
    // así que la latencia importa más aquí que en el parseo estructurado de movimientos.
    let reply = await generateWithFallback({
      contents,
      systemInstruction: systemPrompt,
      temperature: 0.3,
      models: ["gemini-3.1-flash-lite", "gemini-3.7-flash"],
    });
    if (!reply?.trim()) {
      reply = generateSmartLocalChatReply(message, items, recentMoves, totalMovimientos);
    }

    return jsonResponse({
      reply,
      timestamp: new Date().toISOString(),
      metrics: {
        totalUnits,
        totalVolumeM3: Number(totalVolumeM3.toFixed(3)),
        lowStockCount: lowStockItems.length,
        totalMovements: totalMovimientos,
      },
    });
  } catch (error) {
    console.error("Error en chat-inventario:", error);
    return jsonResponse(
      { error: "Error al comunicarse con el Agente Sedimec." },
      500
    );
  }
});
