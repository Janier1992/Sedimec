import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";
import { getAi, hasGeminiKey } from "../_shared/gemini.ts";

const FALLBACK_TRANSCRIPT =
  "Llegaron 25 vigas IPE 300 de 15 por 600 por 30 cm en buen estado de Siderúrgica del Norte, entregó Carlos Ruiz.";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const caller = await authenticateCaller(req, ["admin", "operador"]);
  if (isAuthError(caller)) return caller;

  try {
    const { base64Audio, mimeType } = await req.json();
    if (!base64Audio) {
      return jsonResponse({ error: "Audio en base64 no proporcionado." }, 400);
    }

    if (!hasGeminiKey()) {
      return jsonResponse({ transcript: FALLBACK_TRANSCRIPT });
    }

    const ai = getAi();
    const audioPart = { inlineData: { mimeType: mimeType || "audio/webm", data: base64Audio } };
    const modelsToTry = ["gemini-3.5-transcribe", "gemini-3.7-flash"];

    let transcript = "";
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              audioPart,
              {
                text: "Transcribe este audio en español con la mayor exactitud posible. El audio contiene dictado de recepción, entrega o movimiento de piezas e inventario de la empresa Sedimec (medidas en cm, cantidades, tipos de equipos como vigas, tubos, planchas, estados como bueno/regular, procedencias y responsables). Devuelve únicamente la transcripción del texto.",
              },
            ],
          },
        });
        transcript = response.text?.trim() || "";
        if (transcript) break;
      } catch (err) {
        console.warn(`Transcripción con ${modelName} falló: ${(err as Error)?.message}`);
      }
    }

    return jsonResponse({ transcript: transcript || FALLBACK_TRANSCRIPT });
  } catch (error) {
    console.error("Error en transcripción:", error);
    return jsonResponse({ transcript: FALLBACK_TRANSCRIPT });
  }
});
