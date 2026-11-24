import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateKeys, samePublicKey } from "./crypto";

/** Make sure the public key on the server matches this device's key. Returns this device's keys. */
export async function syncKeys(supabase: SupabaseClient, userId: string, serverJwk?: JsonWebKey | null) {
  const keys = await getOrCreateKeys(userId);
  if (!samePublicKey(keys.publicJwk, serverJwk)) {
    await supabase.from("profiles").update({ public_key: keys.publicJwk }).eq("id", userId);
  }
  return keys;
}
