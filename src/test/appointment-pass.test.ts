import { describe, expect, it } from "vitest";

import { appointmentPassQrValue, isPassActive, isUpcomingAppointment } from "@/lib/appointment-pass";

describe("appointment passes", () => {
  it("encodes the reference code and pass token the clinic verifies", () => {
    expect(appointmentPassQrValue("CP-1042", "tok_abc")).toBe("CAREPULSE|CP-1042|tok_abc");
  });

  it("shows no QR code when the clinic has not issued a token", () => {
    expect(appointmentPassQrValue("CP-1042", null)).toBeNull();
  });

  it("treats a pass past its expiry time as no longer usable", () => {
    const now = new Date("2026-11-21T12:00:00Z");
    expect(isPassActive("2026-11-21T11:59:00Z", now)).toBe(false);
    expect(isPassActive("2026-11-21T12:01:00Z", now)).toBe(true);
    expect(isPassActive(null, now)).toBe(true);
  });

  it("lists today's visits under upcoming, not past", () => {
    expect(isUpcomingAppointment("2026-11-21", "2026-11-21")).toBe(true);
    expect(isUpcomingAppointment("2026-11-20", "2026-11-21")).toBe(false);
  });
});
