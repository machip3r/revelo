import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single browser instance so auth + Realtime share one connection and JWT.
 * (Multiple `createBrowserClient()` calls each had their own Realtime socket and
 * could miss the initial `SIGNED_IN` token sync.)
 */
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
