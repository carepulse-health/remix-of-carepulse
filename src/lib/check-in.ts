/** Clinic roles allowed to check patients in. */
export const CHECK_IN_ROLES = ["admin", "receptionist"] as const;

export function canCheckIn(role: string | null | undefined) {
  return CHECK_IN_ROLES.includes((role ?? "").trim().toLowerCase() as (typeof CHECK_IN_ROLES)[number]);
}

/** Parses CAREPULSE|<reference>|<token>; returns null for anything else. */
export function parseAppointmentPassQr(raw: string) {
  const parts = raw.trim().split("|");
  if (parts.length !== 3 || parts[0] !== "CAREPULSE") return null;
  const reference = (parts[1] ?? "").trim();
  const token = (parts[2] ?? "").trim();
  if (!/^CP-[A-Z0-9]{6,32}$/.test(reference) || !/^[A-Za-z0-9]{16,256}$/.test(token)) return null;
  return { reference, token };
}

export type CheckInFailure =
  | "invalid_format"
  | "not_signed_in"
  | "not_authorized"
  | "invalid_pass"
  | "wrong_clinic"
  | "expired"
  | "already_used"
  | "not_confirmed"
  | "error";

/** Decides whether a verified pass can be used, based on appointment status and expiry. */
export function evaluatePassUse(status: string | null, expiresAt: string | null, now = new Date()): CheckInFailure | null {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "checked_in" || s === "completed") return "already_used";
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return "expired";
  if (s !== "confirmed") return "not_confirmed";
  return null;
}

export const CHECK_IN_MESSAGES: Record<CheckInFailure, string> = {
  invalid_format: "This is not a CarePulse appointment pass.",
  not_signed_in: "Please sign in with your clinic account.",
  not_authorized: "Only clinic admins and receptionists can check patients in.",
  invalid_pass: "This pass is not valid.",
  wrong_clinic: "This pass belongs to a different clinic.",
  expired: "This pass has expired.",
  already_used: "This pass has already been used — the patient is already checked in.",
  not_confirmed: "This appointment is not confirmed, so it can't be checked in.",
  error: "Something went wrong. Please try again.",
};
