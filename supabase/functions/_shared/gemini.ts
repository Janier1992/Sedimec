import { GoogleGenAI } from "npm:@google/genai@^2.4.0";

let aiClient: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") || "" });
  }
  return aiClient;
}

export function hasGeminiKey(): boolean {
  const key = Deno.env.get("GEMINI_API_KEY");
  return !!key && key.trim().length > 0;
}

/**
 * Intenta generar contenido probando varios modelos Gemini en orden
 * (resiliencia ante modelos ocupados/caídos). Devuelve null si ninguno
 * responde o si no hay API key configurada — el llamador debe tener un
 * fallback determinístico para ese caso.
 */
export async function generateWithFallback(params: {
  contents: unknown;
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: unknown;
  models?: string[];
}): Promise<string | null> {
  if (!hasGeminiKey()) return null;

  const ai = getAi();
  const candidateModels = params.models ?? ["gemini-3.7-flash", "gemini-3.1-flash-lite"];

  for (const modelName of candidateModels) {
    try {
      const config: Record<string, unknown> = { temperature: params.temperature ?? 0.3 };
      if (params.systemInstruction) config.systemInstruction = params.systemInstruction;
      if (params.responseMimeType) config.responseMimeType = params.responseMimeType;
      if (params.responseSchema) config.responseSchema = params.responseSchema;

      const response = await ai.models.generateContent({
        model: modelName,
        // deno-lint-ignore no-explicit-any
        contents: params.contents as any,
        config,
      });

      const text = response.text?.trim();
      if (text) return text;
    } catch (err) {
      console.warn(`Modelo ${modelName} falló o no disponible: ${(err as Error)?.message}`);
    }
  }

  return null;
}
