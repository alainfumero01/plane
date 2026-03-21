import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("Missing required Supabase environment variables.");
}

export const createServiceClient = () =>
  createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const createUserClient = (authorization: string) =>
  createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
