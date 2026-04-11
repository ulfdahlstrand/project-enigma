import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationMenu } from "../NavigationMenu";
import { useAuth } from "../../../auth/auth-context";

vi.mock("../../../auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../UserMenu", () => ({
  UserMenu: () => <div>User menu</div>,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    Link: ({ children, to, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
    useRouterState: () => ({
      location: {
        pathname: "/",
      },
    }),
  };
});

describe("NavigationMenu", () => {
  it("shows the admin section for admin users", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "admin@example.com",
        name: "Admin Example",
        role: "admin",
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<NavigationMenu />);

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("AI Prompt Inventory")).toBeInTheDocument();
  });

  it("hides the admin section for consultant users", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "consultant@example.com",
        name: "Consultant Example",
        role: "consultant",
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<NavigationMenu />);

    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("AI Prompt Inventory")).not.toBeInTheDocument();
  });
});
