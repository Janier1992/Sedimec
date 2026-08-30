import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";
import { getAi, hasGeminiKey } from "../_shared/gemini.ts";

interface PiezaInfo {
  tipoEquipo?: string;
  claseEquipo?: string;
  ancho?: number;
  largo?: number;
  profundidad?: number;
  estadoEquipo?: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const caller = await authenticateCaller(req, ["admin", "operador", "auditor"]);
  if (isAuthError(caller)) return caller;
  const { supabase, userId } = caller;

  try {
    if (!hasGeminiKey()) {
      return jsonResponse(
        { error: "La generación de diagramas técnicos requiere configurar GEMINI_API_KEY en los secrets del proyecto." },
        503
      );
    }

    const { prompt, aspectRatio = "1:1", piezaInfo } = (await req.json()) as {
      prompt?: string;
      aspectRatio?: string;
      piezaInfo?: PiezaInfo;
    };

    const fullPrompt =
      prompt ||
      `Technical isometric 3D CAD schematic and engineering diagram of an industrial structural steel piece for Sedimec warehouse.
Piece Type: ${piezaInfo?.tipoEquipo || "Structural Steel"}
Class/Profile: ${piezaInfo?.claseEquipo || "IPE Beam"}
Dimensions: Width ${piezaInfo?.ancho || 20} cm, Length ${piezaInfo?.largo || 600} cm, Depth/Thickness ${piezaInfo?.profundidad || 15} cm.
Condition: ${piezaInfo?.estadoEquipo || "Good"}.
Style: Clean modern industrial isometric technical drawing on blueprint background with precise dimension lines, orthographic perspective, crisp steel material texture and labeled dimension callouts in cm. Professional architectural engineering render, high clarity.`;

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: { parts: [{ text: fullPrompt }] },
      config: { imageConfig: { aspectRatio, imageSize: "1K" } },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    let base64Data = "";
    let mimeType = "image/png";
    for (const part of parts) {
      if (part.inlineData?.data) {
        base64Data = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!base64Data) {
      return jsonResponse({ error: "No se generó imagen en la respuesta." }, 500);
    }

    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const ext = mimeType.includes("jpeg") ? "jpg" : "png";
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("diagramas")
      .upload(path, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("Error subiendo diagrama a Storage:", uploadError);
      // Aun si falla la subida, devolvemos el data-URI para que el usuario no pierda el resultado
      return jsonResponse({ imageUrl: `data:${mimeType};base64,${base64Data}`, aspectRatio });
    }

    const { data: publicUrl } = supabase.storage.from("diagramas").getPublicUrl(path);
    return jsonResponse({ imageUrl: publicUrl.publicUrl, aspectRatio });
  } catch (error) {
    console.error("Error generando diagrama técnico:", error);
    const msg = error instanceof Error ? error.message : "Error al generar imagen técnica";
    return jsonResponse({ error: msg }, 500);
  }
});
