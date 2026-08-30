import { Modality } from "npm:@google/genai@^2.4.0";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";
import { getAi, hasGeminiKey } from "../_shared/gemini.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const caller = await authenticateCaller(req, ["admin", "operador", "auditor"]);
  if (isAuthError(caller)) return caller;

  try {
    const { text, voice } = await req.json();
    if (!text || !String(text).trim()) {
      return jsonResponse({ error: "Texto no proporcionado para TTS." }, 400);
    }

    if (!hasGeminiKey()) {
      return jsonResponse(
        { error: "Servicio de voz remoto no disponible, usando síntesis local." },
        503
      );
    }

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: String(text).slice(0, 500) }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Puck" } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return jsonResponse({ error: "No se generó audio en la respuesta del modelo TTS." }, 500);
    }

    return jsonResponse({ base64Audio });
  } catch (error) {
    console.warn("Gemini TTS no disponible, el cliente usará SpeechSynthesis nativo:", error);
    return jsonResponse(
      { error: "Servicio de voz remoto no disponible, usando síntesis local." },
      503
    );
  }
});
