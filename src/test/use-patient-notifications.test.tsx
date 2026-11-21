import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }));

import { usePatientNotifications } from "@/hooks/use-patient-notifications";

describe("patient notifications", () => {
  beforeEach(() => from.mockReset());

  it("only requests notifications addressed to the signed-in account", async () => {
    const eq = vi.fn();
    const chain = { select: vi.fn(() => chain), eq: eq.mockImplementation(() => chain), order: vi.fn(() => chain), limit: vi.fn().mockResolvedValue({ data: [], error: null }) };
    from.mockReturnValue(chain);

    const { result } = renderHook(() => usePatientNotifications("user-123"));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(from).toHaveBeenCalledExactlyOnceWith("notifications");
    expect(eq).toHaveBeenCalledExactlyOnceWith("user_id", "user-123");
  });

  it("does not query notifications when signed out", () => {
    const { result } = renderHook(() => usePatientNotifications(undefined));
    expect(result.current.status).toBe("disabled");
    expect(from).not.toHaveBeenCalled();
  });
});
