import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

interface RequestAccessPayload {
  email: string;
  password: string;
  nombre: string;
}

// Función PÚBLICA (sin autenticación): crea la cuenta ya confirmada, sin
// enviar ningún correo -- así el autoservicio de registro no depende del
// límite de envío de correos de Supabase Auth. La cuenta nace 'pendiente'
// (ver trigger handle_new_user) y no puede usar el sistema hasta que un
// Administrador la apruebe desde el portal de Administración.
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  try {
    const payload = (await req.json()) as RequestAccessPayload;

    if (!payload.email?.trim() || !payload.password || !payload.nombre?.trim()) {
      return jsonResponse({ error: "Faltan campos obligatorios: nombre, correo y contraseña." }, 400);
    }
    if (payload.password.length < 6) {
      return jsonResponse({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: createErr } = await admin.auth.admin.createUser({
      email: payload.email.trim(),
      password: payload.password,
      email_confirm: true,
      user_metadata: { nombre: payload.nombre.trim(), self_registered: "true" },
    });

    if (createErr) {
      const msg = createErr.message?.includes("already been registered")
        ? "Ya existe una cuenta registrada con este correo."
        : createErr.message;
      return jsonResponse({ error: msg }, 400);
    }

    return jsonResponse({
      success: true,
      mensaje: "Solicitud enviada. Un Administrador debe aprobar tu cuenta antes de que puedas ingresar.",
    });
  } catch (error) {
    console.error("Error en request-access:", error);
    return jsonResponse({ error: "Error al procesar la solicitud de acceso." }, 500);
  }
});
