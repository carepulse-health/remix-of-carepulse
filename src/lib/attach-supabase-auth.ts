import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

/** Sends the signed-in user's access token with server function calls so requireSupabaseAuth can verify them. */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
