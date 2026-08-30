import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { authenticateCaller, isAuthError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const caller = await authenticateCaller(req, ["admin"]);
  if (isAuthError(caller)) return caller;

  try {
    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) {
      return jsonResponse({ error: "Falta el userId a eliminar." }, 400);
    }
    if (userId === caller.userId) {
      return jsonResponse({ error: "No puedes eliminar tu propia cuenta mientras tienes la sesión activa." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Si es el último administrador, no se permite eliminarlo (evitaría dejar
    // el sistema sin nadie que pueda gestionar usuarios).
    const { data: targetProfile } = await admin.from("profiles").select("rol").eq("id", userId).single();
    if (targetProfile?.rol === "admin") {
      const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("rol", "admin");
      if ((count ?? 0) <= 1) {
        return jsonResponse({ error: "No se puede eliminar al último Administrador del sistema." }, 400);
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ success: true, mensaje: "Usuario eliminado correctamente." });
  } catch (error) {
    console.error("Error en admin-delete-user:", error);
    return jsonResponse({ error: "Error al eliminar el usuario." }, 500);
  }
});
