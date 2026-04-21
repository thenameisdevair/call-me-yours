import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// CMY has no Supabase Auth user — the wallet address is the identity. RLS
// policies in 002_rls_policies.sql read a `wallet_address` claim from the JWT,
// so signed-in clients must pass a JWT carrying that claim. For unauthenticated
// browsing (e.g. discovery feed reads of public profile rows) the anon key is
// sufficient because profiles_select_all is permissive.
//
// Usage:
//   const supabase = getSupabase();                        // anon
//   const supabase = getSupabase(walletScopedJwt);         // wallet-scoped

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
}

let anonClient: SupabaseClient<Database> | null = null;

export function getSupabase(accessToken?: string): SupabaseClient<Database> {
    if (accessToken) {
        return createClient<Database>(url!, anonKey!, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    if (!anonClient) {
        anonClient = createClient<Database>(url!, anonKey!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }
    return anonClient;
}

export const supabase = getSupabase();
