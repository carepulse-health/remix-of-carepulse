import { describe, expect, it } from "vitest";

import { appointmentPassQrValue } from "@/lib/appointment-pass";
import { canCheckIn, evaluatePassUse, parseAppointmentPassQr } from "@/lib/check-in";

describe("clinic check-in rules", () => {
  it("reads the patient app's CAREPULSE|reference|token format", () => {
    const qr = appointmentPassQrValue("CP-ABC123DEF456", "testtoken0123456789abcdef")!;
    expect(parseAppointmentPassQr(qr)).toEqual({ reference: "CP-ABC123DEF456", token: "testtoken0123456789abcdef" });
  });
  it("rejects other QR codes", () => {
    expect(parseAppointmentPassQr("https://example.com")).toBeNull();
    expect(parseAppointmentPassQr("CAREPULSE|CP-ABC123DEF456")).toBeNull();
    expect(parseAppointmentPassQr("OTHER|CP-ABC123DEF456|testtoken0123456789abcdef")).toBeNull();
  });
  it("allows only admins and receptionists", () => {
    expect(canCheckIn("admin")).toBe(true);
    expect(canCheckIn("receptionist")).toBe(true);
    expect(canCheckIn("doctor")).toBe(false);
    expect(canCheckIn(null)).toBe(false);
  });
  it("rejects used, expired and unconfirmed passes", () => {
    const now = new Date("2026-11-23T10:00:00Z");
    expect(evaluatePassUse("checked_in", null, now)).toBe("already_used");
    expect(evaluatePassUse("completed", null, now)).toBe("already_used");
    expect(evaluatePassUse("confirmed", "2026-11-22T10:00:00Z", now)).toBe("expired");
    expect(evaluatePassUse("pending", null, now)).toBe("not_confirmed");
    expect(evaluatePassUse("cancelled", null, now)).toBe("not_confirmed");
    expect(evaluatePassUse("confirmed", "2026-11-24T10:00:00Z", now)).toBeNull();
  });
});
