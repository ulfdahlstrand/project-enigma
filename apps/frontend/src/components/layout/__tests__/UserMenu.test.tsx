import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "../UserMenu";

vi.mock("../../../auth/auth-context", () => ({
  useAuth: () => ({
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../../auth/use-current-user", () => ({
  useCurrentUser: () => ({
    name: "Ulf Dahlstrand",
    email: "ulf@example.com",
    picture: null,
  }),
}));

vi.mock("../../../lib/color-mode-context", () => ({
  useColorMode: () => ({
    mode: "light",
    toggleColorMode: vi.fn(),
  }),
}));

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("UserMenu", () => {
  it("shows a settings link in the popup menu", async () => {
    render(<UserMenu />);

    fireEvent.click(screen.getByText("Ulf Dahlstrand"));
    fireEvent.click(await screen.findByText("Settings"));

    expect(navigateMock).toHaveBeenCalledWith({ to: "/settings" });
  });
});
