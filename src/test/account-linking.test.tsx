import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args), auth: { signOut: vi.fn() } },
}));

import { AccountScreen } from "@/components/carepulse-patient-app";
import type { PatientRecordState } from "@/hooks/use-patient-session";

const session = { user: { id: "user-1", email: "patient@example.com" } } as unknown as Session;

function renderAccount(record: PatientRecordState, refreshRecord = vi.fn(), onAccountLinked = vi.fn()) {
  render(<AccountScreen accountView="login" onSetView={vi.fn()} session={session} record={record} refreshRecord={refreshRecord} onAccountLinked={onAccountLinked} />);
  return { refreshRecord, onAccountLinked };
}

const linkedRecord = {
  status: "linked",
  patient: { id: "p1", clinic_id: "c1", auth_user_id: "user-1", full_name: "Ada Obi", email: "patient@example.com" },
  appointments: [],
  passes: [],
  clinic: { id: "c1", name: "CarePulse clinic", address: null, phone: null, opening_hours: {} },
} as unknown as PatientRecordState;

describe("Account screen record linking", () => {
  beforeEach(() => rpc.mockReset());

  it("shows the link button to a signed-in patient without a linked record", () => {
    renderAccount({ status: "unlinked" });
    expect(screen.getByRole("button", { name: /link my clinic record/i })).toBeTruthy();
  });

  it("hides the link button and confirms once the record is linked", () => {
    renderAccount(linkedRecord);
    expect(screen.queryByRole("button", { name: /link my clinic record/i })).toBeNull();
    expect(screen.getByText(/clinic record linked/i)).toBeTruthy();
  });

  it("links through the secure clinic function and reloads the profile", async () => {
    rpc.mockResolvedValue({ data: { success: true }, error: null });
    const { refreshRecord, onAccountLinked } = renderAccount({ status: "unlinked" });

    fireEvent.click(screen.getByRole("button", { name: /link my clinic record/i }));

    await waitFor(() => expect(refreshRecord).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledExactlyOnceWith("link_patient_account");
    expect(onAccountLinked).toHaveBeenCalledOnce();
  });

  it("tells an unverified patient to confirm their email first", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "EMAIL_NOT_VERIFIED" } });
    const { refreshRecord } = renderAccount({ status: "unlinked" });

    fireEvent.click(screen.getByRole("button", { name: /link my clinic record/i }));

    expect(await screen.findByText(/confirm your email address/i)).toBeTruthy();
    expect(refreshRecord).not.toHaveBeenCalled();
  });
});
