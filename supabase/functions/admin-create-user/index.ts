import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";

interface CreateUserPayload {
  email: string;
  password: string;
  nombre: string;
  cargo?: string;
  rol: "admin" | "operador" | "auditor";
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  // Solo un Administrador puede crear usuarios -- verificado server-side vía JWT,
  // nunca confiando en nada que declare el cliente.
  const caller = await authenticateCaller(req, ["admin"]);
  if (isAuthError(caller)) return caller;

  try {
    const payload = (await req.json()) as CreateUserPayload;

    if (!payload.email || !payload.password || !payload.nombre || !payload.rol) {
      return jsonResponse({ error: "Faltan campos obligatorios: email, password, nombre, rol." }, 400);
    }
    if (payload.password.length < 8) {
      return jsonResponse({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    }
    if (!["admin", "operador", "auditor"].includes(payload.rol)) {
      return jsonResponse({ error: "Rol inválido." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { nombre: payload.nombre, cargo: payload.cargo || "" },
    });

    if (createErr) {
      const msg = createErr.message?.includes("already been registered")
        ? "Ya existe un usuario con ese correo electrónico."
        : createErr.message;
      return jsonResponse({ error: msg }, 400);
    }

    // El trigger handle_new_user siempre asigna 'operador' por defecto;
    // aquí, con service_role, se ajusta al rol real solicitado por el admin.
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .update({ rol: payload.rol, nombre: payload.nombre, cargo: payload.cargo || null })
      .eq("id", created.user.id)
      .select("id, nombre, email, rol, cargo")
      .single();

    if (profileErr) {
      return jsonResponse({ error: `Usuario creado pero no se pudo asignar el rol: ${profileErr.message}` }, 500);
    }

    return jsonResponse({
      success: true,
      mensaje: `Usuario ${payload.email} creado con rol ${payload.rol}.`,
      user: profile,
    });
  } catch (error) {
    console.error("Error en admin-create-user:", error);
    return jsonResponse({ error: "Error al crear el usuario." }, 500);
  }
});
