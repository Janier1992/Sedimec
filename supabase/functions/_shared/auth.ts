import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

export type UserRole = "admin" | "operador" | "auditor";

export interface AuthedCaller {
  supabase: SupabaseClient;
  userId: string;
  role: UserRole;
}

/**
 * Reconstruye la identidad del que llama a partir del JWT reenviado por
 * supabase-js (nunca de un header declarado por el cliente). El cliente
 * Supabase devuelto respeta RLS como ese usuario.
 *
 * IMPORTANTE: toda respuesta de error debe pasar por jsonResponse() (que
 * agrega los headers CORS). Un Response sin esos headers hace que el
 * navegador lo bloquee y lo reporte como error de CORS, ocultando el
 * verdadero 401/403 -- ya nos pasó una vez, no repetir el error.
 */
export async function authenticateCaller(
  req: Request,
  allowedRoles: UserRole[]
): Promise<AuthedCaller | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "No autenticado: falta el token de sesión." }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return jsonResponse({ error: "Sesión inválida o expirada. Vuelve a iniciar sesión." }, 401);
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return jsonResponse({ error: "No se encontró el perfil del usuario." }, 403);
  }

  const role = profile.rol as UserRole;
  if (!allowedRoles.includes(role)) {
    return jsonResponse(
      { error: `Acceso Denegado (RBAC): el rol '${role}' no tiene permiso para esta acción.` },
      403
    );
  }

  return { supabase, userId: user.id, role };
}

export function isAuthError(x: AuthedCaller | Response): x is Response {
  return x instanceof Response;
}
