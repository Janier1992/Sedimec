import { Type } from "npm:@google/genai@^2.4.0";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";
import { generateWithFallback } from "../_shared/gemini.ts";
import { parseVoiceCommandRuleBased, ParsedVoiceMovement } from "../_shared/voiceParser.ts";

type ParsedResult = ParsedVoiceMovement & Record<string, unknown>;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const caller = await authenticateCaller(req, ["admin", "operador"]);
  if (isAuthError(caller)) return caller;

  const reqClone = req.clone();

  try {
    const { text } = await req.json();
    if (!text || !String(text).trim()) {
      return jsonResponse({ error: "Texto para procesar no proporcionado." }, 400);
    }

    const prompt = `Analiza la siguiente instrucción dictada por voz para el sistema de control de inventario de Sedimec y extrae los campos estructurados en formato JSON.

Texto dictado:
"${text}"

Reglas de negocio Sedimec:
- tipoMovimiento: "Entrada" o "Salida".
- tipoEquipo: Tipo general de pieza (ej: "Perfil Estructural", "Chapa / Plancha", "Estructura Metálica").
- claseEquipo: Especificación técnica (ej: "Viga IPE 300", "Viga HEA 200", "Tubo Rectangular 100x50", "Plancha Estructural A36").
- estadoEquipo: Uno de ["Bueno", "Regular", "Dañado", "Para Reparación", "Nuevo", "En Mantenimiento"].
- ancho: Número en cm.
- largo: Número en cm.
- profundidad: Número en cm.
- cantidad: Número entero positivo.
- procedenciaDestino: Origen si Entrada, o Destino si Salida.
- responsable: Nombre del responsable o transportista.
- contactoResponsable: Teléfono o contacto si se dictó.
- observaciones: Notas adicionales.`;

    let parsed: ParsedResult | null = null;

    const raw = await generateWithFallback({
      contents: prompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tipoMovimiento: { type: Type.STRING, enum: ["Entrada", "Salida"] },
          tipoEquipo: { type: Type.STRING },
          claseEquipo: { type: Type.STRING },
          estadoEquipo: {
            type: Type.STRING,
            enum: ["Bueno", "Regular", "Dañado", "Para Reparación", "Nuevo", "En Mantenimiento"],
          },
          ancho: { type: Type.NUMBER },
          largo: { type: Type.NUMBER },
          profundidad: { type: Type.NUMBER },
          cantidad: { type: Type.INTEGER },
          procedenciaDestino: { type: Type.STRING },
          responsable: { type: Type.STRING },
          contactoResponsable: { type: Type.STRING },
          observaciones: { type: Type.STRING },
        },
        required: [
          "tipoMovimiento", "tipoEquipo", "claseEquipo", "estadoEquipo",
          "ancho", "largo", "profundidad", "cantidad", "procedenciaDestino", "responsable",
        ],
      },
    });

    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    if (!parsed || !parsed.claseEquipo) {
      parsed = parseVoiceCommandRuleBased(text);
    }

    const alertas: string[] = [];
    if (!parsed.procedenciaDestino || String(parsed.procedenciaDestino).length < 3) {
      parsed.procedenciaDestino = parsed.tipoMovimiento === "Entrada" ? "Proveedor Principal" : "Obra Destino";
      alertas.push("Se completó procedencia por defecto.");
    }
    if (!parsed.responsable || String(parsed.responsable).length < 3) {
      parsed.responsable = "Operario de Patio";
      alertas.push("Se asignó responsable de patio.");
    }
    if (!parsed.cantidad || Number(parsed.cantidad) <= 0) {
      parsed.cantidad = 1;
      alertas.push("La cantidad se ajustó a 1.");
    }

    return jsonResponse({ parsed, alertasValidacion: alertas, rawTranscript: text });
  } catch (error) {
    console.error("Error al estructurar comando de voz, usando parser local:", error);
    let text = "";
    try {
      text = (await reqClone.json())?.text || "";
    } catch {
      // no se pudo recuperar el texto original; se ignora
    }
    const fallbackParsed = parseVoiceCommandRuleBased(text);
    return jsonResponse({
      parsed: fallbackParsed,
      alertasValidacion: ["Procesado mediante motor analítico local de Sedimec."],
      rawTranscript: text,
    });
  }
});
