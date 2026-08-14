import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return { url, publishableKey };
}

export async function createClient() {
  const { url, publishableKey } = getEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Solo lectura en este spec: no hay sesión de Supabase que refrescar
        // todavía. Server Components no pueden escribir cookies de todas
        // formas; este no-op evita que la llamada lance al intentarlo.
      },
    },
  });
}

// generateStaticParams corre en build time, sin request HTTP: cookies() de
// next/headers lanza si se llama ahí. Este cliente no depende de cookies,
// válido porque solo lee datos públicos (RLS select abierto, sin auth todavía).
export function createStaticClient() {
  const { url, publishableKey } = getEnv();
  return createSupabaseClient<Database>(url, publishableKey);
}
