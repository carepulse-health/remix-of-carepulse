import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), auth: { signOut: vi.fn() } } }));

import { PatientSidebar } from "@/components/carepulse-patient-app";

function renderSidebar(props: Partial<Parameters<typeof PatientSidebar>[0]> = {}) {
  const onNavigate = vi.fn();
  render(<PatientSidebar activeView="appointments" onNavigate={onNavigate} unreadCount={0} accountName="Ada Obi" accountDetail="ada@example.com" initials="AO" {...props} />);
  return { onNavigate, nav: within(screen.getByRole("navigation", { name: "Main navigation" })) };
}

describe("patient sidebar", () => {
  it("lists Home, Find a Doctor, Appointments, Inbox and Account", () => {
    const { nav } = renderSidebar();
    for (const label of ["Home", "Find a Doctor", "Appointments", "Inbox", "Account"]) {
      expect(nav.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("keeps the care assistant reachable", () => {
    const { nav } = renderSidebar();
    expect(nav.getByRole("button", { name: "Care assistant" })).toBeTruthy();
  });

  it("marks only the active page as current", () => {
    const { nav } = renderSidebar({ activeView: "appointments" });
    expect(nav.getByRole("button", { name: "Appointments" }).getAttribute("aria-current")).toBe("page");
    expect(nav.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBeNull();
    expect(nav.getByRole("button", { name: "Inbox" }).getAttribute("aria-current")).toBeNull();
  });

  it("opens the Inbox page when Inbox is tapped", () => {
    const { nav, onNavigate } = renderSidebar();
    fireEvent.click(nav.getByRole("button", { name: "Inbox" }));
    expect(onNavigate).toHaveBeenCalledWith("notifications");
  });

  it("keeps page names available when collapsed to icons", () => {
    const onToggle = vi.fn();
    const { nav } = renderSidebar({ collapsed: true, onToggleCollapsed: onToggle });
    expect(nav.getByRole("button", { name: "Find a Doctor" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("PatientBottomNav", () => {
  it("shows five tabs, highlights the active one and navigates", async () => {
    const { PatientBottomNav } = await import("@/components/carepulse-patient-app");
    const onNavigate = vi.fn();
    render(<PatientBottomNav activeView="notifications" onNavigate={onNavigate} unreadCount={0} />);
    const nav = screen.getByRole("navigation", { name: "Bottom navigation" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Home", "Find a Doctor", "Appointments", "Inbox", "Account"]);
    expect(within(nav).getByRole("button", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(nav).getByRole("button", { name: /Find a Doctor/ }));
    expect(onNavigate).toHaveBeenCalledWith("doctors");
  });
});
