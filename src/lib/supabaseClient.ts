import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y pega las credenciales de tu proyecto Supabase.'
  );
}

// En desarrollo, cada recarga en caliente (HMR) de Vite re-ejecuta este módulo,
// lo que crearía un nuevo GoTrueClient en cada edición de código sin recargar la
// página -- dos instancias compitiendo por la misma sesión guardada en
// localStorage produce comportamiento indefinido (sesiones que se corrompen o
// se invalidan solas). Se guarda la instancia real en `window` para
// sobrevivir a la recarga en caliente y garantizar un único cliente siempre.
declare global {
  interface Window {
    __sedimecSupabaseClient__?: SupabaseClient;
  }
}

function getSupabaseClient(): SupabaseClient {
  if (import.meta.env.DEV && window.__sedimecSupabaseClient__) {
    return window.__sedimecSupabaseClient__;
  }
  const client = createClient(supabaseUrl, supabaseAnonKey);
  if (import.meta.env.DEV) {
    window.__sedimecSupabaseClient__ = client;
    // Permite inspeccionar la sesión desde la consola del navegador para depurar.
    (window as unknown as { supabase: SupabaseClient }).supabase = client;
  }
  return client;
}

export const supabase = getSupabaseClient();
