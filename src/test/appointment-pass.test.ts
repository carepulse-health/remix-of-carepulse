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

import { appointmentStatusLabel, isPassValid, passDownloadFileName } from "@/lib/appointment-pass";

describe("appointment pass validity", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const pass = { qr_code: "tok_abc", expires_at: null };

  it("shows a pass only for a visit the clinic has confirmed", () => {
    expect(isPassValid(pass, "confirmed", now)).toBe(true);
    expect(isPassValid(pass, "pending", now)).toBe(false);
    expect(isPassValid(pass, "cancelled", now)).toBe(false);
  });

  it("hides a pass that has no token or has expired", () => {
    expect(isPassValid({ qr_code: null, expires_at: null }, "confirmed", now)).toBe(false);
    expect(isPassValid({ qr_code: "tok_abc", expires_at: "2026-11-21T11:00:00Z" }, "confirmed", now)).toBe(false);
    expect(isPassValid(undefined, "confirmed", now)).toBe(false);
  });

  it("names the downloaded pass by its reference, never its token", () => {
    expect(passDownloadFileName("CP-ABC123")).toBe("carepulse-pass-CP-ABC123.png");
  });
});

describe("checked-in appointments", () => {
  it("displays checked_in as Checked in", () => {
    expect(appointmentStatusLabel("checked_in")).toBe("Checked in");
  });

  it("keeps every existing appointment status label unchanged", () => {
    for (const status of ["pending", "confirmed", "cancelled", "completed", "rescheduled"]) {
      expect(appointmentStatusLabel(status)).toBe(status);
    }
  });

  it("hides the pass after check-in while keeping confirmed passes valid", () => {
    const now = new Date("2026-11-21T12:00:00Z");
    const pass = { qr_code: "tok_abc", expires_at: null };
    expect(isPassValid(pass, "checked_in", now)).toBe(false);
    expect(isPassValid(pass, "confirmed", now)).toBe(true);
  });
});
