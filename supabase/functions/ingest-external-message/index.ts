import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/client.ts";
import { requireUser } from "../_shared/auth.ts";

type ExternalIngestRequest = {
  companyId: string;
  threadId: string;
  siteId?: string;
  provider: "whatsapp" | "email" | "sms" | string;
  externalChatId: string;
  externalMessageId: string;
  direction: "inbound" | "outbound";
  payload: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const authorization = req.headers.get("Authorization");
    const user = await requireUser(authorization);
    const payload = (await req.json()) as ExternalIngestRequest;

    if (!payload.companyId || !payload.threadId || !payload.provider || !payload.externalChatId || !payload.externalMessageId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const supabase = createServiceClient();

    const { data: membership, error: membershipError } = await supabase
      .from("user_company_memberships")
      .select("id")
      .eq("company_id", payload.companyId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const { data: thread, error: threadError } = await supabase
      .from("communication_threads")
      .select("id,site_id")
      .eq("id", payload.threadId)
      .eq("company_id", payload.companyId)
      .maybeSingle();

    if (threadError) throw threadError;
    if (!thread) {
      return new Response(JSON.stringify({ error: "Thread not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const { data, error } = await supabase
      .from("external_message_links")
      .upsert(
        {
          company_id: payload.companyId,
          thread_id: payload.threadId,
          site_id: payload.siteId ?? thread.site_id,
          provider: payload.provider,
          external_chat_id: payload.externalChatId,
          external_message_id: payload.externalMessageId,
          direction: payload.direction,
          payload_json: payload.payload ?? {},
          ingested_at: new Date().toISOString(),
        },
        { onConflict: "provider,external_chat_id,external_message_id" },
      )
      .select("id,provider,external_chat_id,external_message_id,direction,ingested_at")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        status: "ingested",
        message: data,
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
