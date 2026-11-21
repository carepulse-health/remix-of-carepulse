import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PatientNotification = Pick<Tables<"notifications">, "id" | "title" | "message" | "notification_type" | "is_read" | "created_at">;

export type PatientNotificationsState =
  | { status: "disabled"; notifications: PatientNotification[] }
  | { status: "loading"; notifications: PatientNotification[] }
  | { status: "error"; notifications: PatientNotification[]; message: string }
  | { status: "ready"; notifications: PatientNotification[] };

/** Reads only notifications addressed to the signed-in account (user_id = auth user), never clinic-wide ones. */
export function usePatientNotifications(userId: string | undefined): PatientNotificationsState {
  const [state, setState] = useState<PatientNotificationsState>({ status: "disabled", notifications: [] });

  useEffect(() => {
    if (!userId) {
      setState({ status: "disabled", notifications: [] });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", notifications: [] });
    void (async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, notification_type, is_read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) {
        setState({ status: "error", notifications: [], message: "Your clinic updates couldn’t be loaded right now." });
        return;
      }
      setState({ status: "ready", notifications: data ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return userId ? state : { status: "disabled", notifications: [] };
}
