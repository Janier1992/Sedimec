/**
 * Parser NLP determinístico por reglas para dictado de voz en español.
 * Es el fallback cuando no hay GEMINI_API_KEY o la llamada al modelo falla,
 * y es lo que mantiene la demo 100% funcional sin ninguna key configurada.
 */
export interface ParsedVoiceMovement {
  tipoMovimiento: "Entrada" | "Salida";
  tipoEquipo: string;
  claseEquipo: string;
  estadoEquipo: string;
  ancho: number;
  largo: number;
  profundidad: number;
  cantidad: number;
  procedenciaDestino: string;
  responsable: string;
  contactoResponsable: string;
  observaciones: string;
}

export function parseVoiceCommandRuleBased(text: string): ParsedVoiceMovement {
  const lower = text.toLowerCase();
  const isSalida = /(salida|despacho|entrega|envio|retiro|se fueron|salieron|para la obra|hacia)/i.test(lower);
  const tipoMovimiento: "Entrada" | "Salida" = isSalida ? "Salida" : "Entrada";

  let cantidad = 1;
  const numMatch = lower.match(/(\d+)\s*(vigas?|tubos?|planchas?|unidades?|piezas?|perfiles?|laminas?|unds?|und)?/i);
  if (numMatch?.[1]) cantidad = parseInt(numMatch[1], 10);

  let claseEquipo = "Viga IPE 300";
  let tipoEquipo = "Perfil Estructural";

  // Nota: se usa \w* (en vez de \s*) tras la primera palabra de cada patrón
  // para tolerar plurales dictados por voz (ej. "tubos rectangulares",
  // "vigas ipe 300"), ya que \s* solo permitía espacios y no la "s"/"es" de plural.
  if (/vigas?\s*ipe\s*300/i.test(lower)) {
    claseEquipo = "Viga IPE 300";
    tipoEquipo = "Perfil Estructural";
  } else if (/vigas?\s*hea\s*200/i.test(lower)) {
    claseEquipo = "Viga HEA 200";
    tipoEquipo = "Perfil Estructural";
  } else if (/tubo\w*\s*rectangular\w*/i.test(lower) || /100x50/i.test(lower)) {
    claseEquipo = "Tubo Rectangular 100x50";
    tipoEquipo = "Perfil Estructural";
  } else if (/plancha|a36|chapa/i.test(lower)) {
    claseEquipo = "Plancha Estructural A36";
    tipoEquipo = "Chapa / Plancha";
  } else if (/angulo/i.test(lower)) {
    claseEquipo = "Ángulo Estructural 2x2";
    tipoEquipo = "Perfil Estructural";
  } else if (/perfil\w*\s*c\b/i.test(lower)) {
    claseEquipo = "Perfil C 150x50";
    tipoEquipo = "Perfil Estructural";
  } else if (/tubo\w*\s*redondo\w*/i.test(lower)) {
    claseEquipo = "Tubo Redondo 3 pulg";
    tipoEquipo = "Perfil Estructural";
  }

  let ancho = 15;
  let largo = 600;
  let profundidad = 30;

  const dimMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|por|×)\s*(\d+(?:\.\d+)?)\s*(?:x|por|×)\s*(\d+(?:\.\d+)?)/i);
  if (dimMatch) {
    ancho = parseFloat(dimMatch[1]);
    largo = parseFloat(dimMatch[2]);
    profundidad = parseFloat(dimMatch[3]);
  } else if (claseEquipo === "Plancha Estructural A36") {
    ancho = 120;
    largo = 240;
    profundidad = 1.2;
  } else if (claseEquipo === "Tubo Rectangular 100x50") {
    ancho = 10;
    largo = 600;
    profundidad = 5;
  }

  let estadoEquipo = "Bueno";
  if (/regular/i.test(lower)) estadoEquipo = "Regular";
  else if (/dañado|dañada|roto|defectuoso/i.test(lower)) estadoEquipo = "Dañado";
  else if (/nuevo|nueva|excelente/i.test(lower)) estadoEquipo = "Nuevo";
  else if (/mantenimiento|reparacion/i.test(lower)) estadoEquipo = "Para Reparación";

  let procedenciaDestino = tipoMovimiento === "Entrada" ? "Siderúrgica del Norte S.A." : "Obra Principal";
  const provMatch = text.match(/(?:de|proveedor|origen)\s+([A-Za-zÁ-ÿ0-9\s.\-]{3,35}?)(?:,| entregó| responsable| recibio|\.|$)/i);
  const destMatch = text.match(/(?:para|hacia|destino|obra)\s+([A-Za-zÁ-ÿ0-9\s.\-]{3,35}?)(?:,| entregó| responsable| recibio|\.|$)/i);
  if (tipoMovimiento === "Entrada" && provMatch?.[1]) {
    procedenciaDestino = provMatch[1].trim();
  } else if (tipoMovimiento === "Salida" && destMatch?.[1]) {
    procedenciaDestino = destMatch[1].trim();
  }

  let responsable = "Carlos Humberto Ruiz";
  const respMatch = text.match(/(?:entregó|entrego|recibió|recibio|responsable|transportista|chofer)\s+([A-Za-zÁ-ÿ\s]{3,30}?)(?:\.|$|,)/i);
  if (respMatch?.[1]) responsable = respMatch[1].trim();

  return {
    tipoMovimiento,
    tipoEquipo,
    claseEquipo,
    estadoEquipo,
    ancho,
    largo,
    profundidad,
    cantidad,
    procedenciaDestino,
    responsable,
    contactoResponsable: "+57 312 458 9921",
    observaciones: `Dictado por voz procesado automáticamente: "${text}"`,
  };
}
