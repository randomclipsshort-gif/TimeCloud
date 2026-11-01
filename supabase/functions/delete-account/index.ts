import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const accountDataTables = [
  "private_salary_vault",
  "attendance_punches",
  "user_workspaces",
] as const;

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required." }, {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return Response.json({ error: "Account deletion is not configured." }, {
      status: 500,
      headers: corsHeaders,
    });
  }

  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authenticationError } = await callerClient.auth.getUser();
  if (authenticationError || !user) {
    return Response.json({ error: "The session is invalid or expired." }, {
      status: 401,
      headers: corsHeaders,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of accountDataTables) {
    const { error: cleanupError } = await adminClient
      .from(table)
      .delete()
      .eq("user_id", user.id);
    if (cleanupError && isMissingTableError(cleanupError)) continue;
    if (cleanupError) {
      console.error(`Account data cleanup failed for ${table}:`, cleanupError);
      return Response.json({
        error: "Account data could not be fully removed. Your account is still active; retry deletion or contact support.",
      }, {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  for (const table of accountDataTables) {
    const { data, error: verificationError } = await adminClient
      .from(table)
      .select("user_id")
      .eq("user_id", user.id)
      .limit(1);
    if (verificationError && isMissingTableError(verificationError)) continue;
    if (verificationError || data?.length) {
      console.error(
        `Account data cleanup verification failed for ${table}:`,
        verificationError ?? "An account-owned row remains.",
      );
      return Response.json({
        error: "Account data removal could not be verified. Your account is still active; retry deletion or contact support.",
      }, {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  const { error: deletionError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deletionError) {
    console.error("Auth account deletion failed after account data cleanup:", deletionError);
    return Response.json({
      error: "Your app data was removed, but account deletion did not finish. Please retry deletion or contact support.",
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }

  for (const table of accountDataTables) {
    const { data, error: verificationError } = await adminClient
      .from(table)
      .select("user_id")
      .eq("user_id", user.id)
      .limit(1);
    if (verificationError && isMissingTableError(verificationError)) continue;
    if (verificationError || data?.length) {
      console.error(
        `Post-deletion verification failed for ${table}:`,
        verificationError ?? "An account-owned row remains after Auth deletion.",
      );
      return Response.json({
        error: "The account was deleted, but removal of all app data could not be verified. Contact support.",
      }, {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return Response.json({
    success: true,
    deletedTables: accountDataTables,
  }, { headers: corsHeaders });
});
