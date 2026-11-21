import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: { signOut: vi.fn() } } }));

import { AppointmentDetails } from "@/components/carepulse-patient-app";
import type { PatientAppointment, PatientClinic, PatientPass } from "@/hooks/use-patient-session";

const SECRET = "9f8e7d6c5b4a39281706f5e4d3c2b1a0aabbccddeeff00112233445566778899";

const appointment = {
  id: "a1", clinic_id: "c1", patient_id: "p1", doctor_id: "d1",
  appointment_date: "2026-11-23", appointment_time: "18:41:00", reason: "Check-up", status: "confirmed",
  created_at: "2026-11-21T14:41:52Z", updated_at: null,
  doctor: { full_name: "Dr. Tola Ade", specialization: "Family medicine" },
} as PatientAppointment;
const clinic: PatientClinic = { id: "c1", name: "CarePulse clinic", address: "12 Marina Rd", phone: "+2348000000000", opening_hours: {} };
const pass: PatientPass = { id: "x1", appointment_id: "a1", reference_code: "CP-ABC123DEF456", qr_code: SECRET, pdf_url: null, issued_at: null, expires_at: null };

function renderDetails(overrides: Partial<PatientAppointment>, withPass: PatientPass | undefined) {
  return render(<AppointmentDetails appointment={{ ...appointment, ...overrides }} pass={withPass} clinic={clinic} onBack={vi.fn()} onRefresh={vi.fn()} />);
}

describe("appointment details", () => {
  it("shows the visit, doctor, clinic and booking details", () => {
    renderDetails({}, undefined);
    expect(screen.getByText("Dr. Tola Ade")).toBeTruthy();
    expect(screen.getByText("Family medicine")).toBeTruthy();
    expect(screen.getByText("12 Marina Rd")).toBeTruthy();
    expect(screen.getByText("+2348000000000")).toBeTruthy();
  });

  it("explains the pass is pending when the clinic has not issued one", () => {
    renderDetails({ status: "pending" }, undefined);
    expect(screen.getByText("Your appointment pass will appear once the clinic confirms your visit.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /download pass/i })).toBeNull();
  });

  it("shows the reference and QR code for a confirmed visit without printing the secret token", () => {
    const { container } = renderDetails({}, pass);
    expect(screen.getByText("CP-ABC123DEF456")).toBeTruthy();
    expect(screen.getByRole("img", { name: /qr code for appointment pass/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /download pass/i })).toBeTruthy();
    expect(container.innerHTML).not.toContain(SECRET);
  });

  it("does not show a pass for a visit that is no longer confirmed", () => {
    renderDetails({ status: "cancelled" }, pass);
    expect(screen.queryByText("CP-ABC123DEF456")).toBeNull();
    expect(screen.getByText("Your appointment pass will appear once the clinic confirms your visit.")).toBeTruthy();
  });

  it("shows the checked-in message and hides the pass and QR code after check-in", () => {
    const { container } = renderDetails({ status: "checked_in" }, pass);
    expect(screen.getByText("Checked in")).toBeTruthy();
    expect(screen.getByText("You're checked in — please wait to be called.")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /qr code for appointment pass/i })).toBeNull();
    expect(screen.queryByText("CP-ABC123DEF456")).toBeNull();
    expect(screen.queryByRole("button", { name: /download pass/i })).toBeNull();
    expect(container.innerHTML).not.toContain(SECRET);
  });
});
