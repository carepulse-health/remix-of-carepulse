/** Value encoded in an appointment pass QR code; staff verify it with verify_appointment_pass(reference, token). */
export function appointmentPassQrValue(referenceCode: string, token: string | null) {
  if (!token) return null;
  return `CAREPULSE|${referenceCode}|${token}`;
}

/** Splits appointments into upcoming (today or later) and past, by local calendar date. */
export function isUpcomingAppointment(appointmentDate: string, today: string) {
  return appointmentDate >= today;
}

export function localDateKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A pass is usable unless its expiry time has passed. */
export function isPassActive(expiresAt: string | null, now = new Date()) {
  return !expiresAt || new Date(expiresAt).getTime() > now.getTime();
}

/** Visit statuses that mean the clinic has confirmed the appointment. */
export function isConfirmedStatus(status: string | null) {
  return (status ?? "").trim().toLowerCase() === "confirmed";
}

/**
 * A pass is shown to the patient only when the clinic has confirmed the visit,
 * issued a token for it, and the pass has not expired.
 */
export function isPassValid(
  pass: { qr_code: string | null; expires_at: string | null } | undefined,
  appointmentStatus: string | null,
  now = new Date(),
) {
  return Boolean(pass?.qr_code) && isConfirmedStatus(appointmentStatus) && isPassActive(pass?.expires_at ?? null, now);
}

/** Download file name uses only the public reference code, never the secret token. */
export function passDownloadFileName(referenceCode: string) {
  return `carepulse-pass-${referenceCode.replace(/[^A-Za-z0-9-]/g, "")}.png`;
}
