import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canCheckIn, evaluatePassUse, parseAppointmentPassQr, type CheckInFailure } from "@/lib/check-in";

export type CheckInResult =
  | { ok: true; reference: string; patientName: string | null; appointmentDate: string; appointmentTime: string }
  | { ok: false; reason: CheckInFailure };

const fail = (reason: CheckInFailure): CheckInResult => ({ ok: false, reason });

/** Returns whether the signed-in user may use the scanner (admin or receptionist of a clinic). */
export const getCheckInAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("clinic_members").select("role").eq("user_id", context.userId);
    return { allowed: (data ?? []).some((m) => canCheckIn(m.role)) };
  });

/** Verifies a scanned pass on the server and marks the appointment checked_in. Never returns or logs the token. */
export const checkInWithPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { qr: string }) => ({ qr: typeof input?.qr === "string" ? input.qr.slice(0, 600) : "" }))
  .handler(async ({ data, context }): Promise<CheckInResult> => {
    const parsed = parseAppointmentPassQr(data.qr);
    if (!parsed) return fail("invalid_format");
    const { supabase, userId } = context;

    const { data: members, error: memberError } = await supabase
      .from("clinic_members")
      .select("clinic_id, role")
      .eq("user_id", userId);
    if (memberError) return fail("error");
    const staffClinics = (members ?? []).filter((m) => canCheckIn(m.role)).map((m) => m.clinic_id);
    if (staffClinics.length === 0) return fail("not_authorized");

    // Token comparison happens inside the clinic's existing database check.
    const { data: verified, error: verifyError } = await supabase.rpc("verify_appointment_pass", {
      _reference_code: parsed.reference,
      _token: parsed.token,
    });
    if (verifyError) return fail("error");

    if (!verified) {
      // Caller is verified staff: look up only which clinic owns this reference, to explain the rejection.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: owner } = await supabaseAdmin
        .from("appointment_passes")
        .select("clinic_id")
        .eq("reference_code", parsed.reference)
        .maybeSingle();
      if (owner && !staffClinics.includes(owner.clinic_id)) return fail("wrong_clinic");
      return fail("invalid_pass");
    }

    const { data: pass } = await supabase
      .from("appointment_passes")
      .select("appointment_id, clinic_id, expires_at")
      .eq("reference_code", parsed.reference)
      .maybeSingle();
    if (!pass) return fail("invalid_pass");
    if (!staffClinics.includes(pass.clinic_id)) return fail("wrong_clinic");

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, clinic_id, status, appointment_date, appointment_time, patients(full_name)")
      .eq("id", pass.appointment_id)
      .maybeSingle();
    if (!appt || appt.clinic_id !== pass.clinic_id) return fail("invalid_pass");

    const problem = evaluatePassUse(appt.status, pass.expires_at);
    if (problem) return fail(problem);

    // Only moves confirmed -> checked_in, so two simultaneous scans can't both succeed.
    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update({ status: "checked_in" })
      .eq("id", appt.id)
      .eq("clinic_id", pass.clinic_id)
      .eq("status", "confirmed")
      .select("id");
    if (updateError) return fail("error");
    if (!updated || updated.length === 0) return fail("already_used");

    const patient = appt.patients as { full_name: string } | null;
    return {
      ok: true,
      reference: parsed.reference,
      patientName: patient?.full_name ?? null,
      appointmentDate: appt.appointment_date,
      appointmentTime: appt.appointment_time,
    };
  });
