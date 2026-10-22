import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./pages/Login";
import Account from "./pages/Account";
import { deleteAccount, getProviders, googleSignIn } from "./services/auth.api";
import { renderWithApp } from "../../test/renderWithApp";

vi.mock("./services/auth.api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  getProviders: vi.fn(),
  googleSignIn: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn()
}));
// the Account page's plan card isn't what's tested here
vi.mock("../billing/components/PlanSummary", () => ({ default: () => null }));
vi.mock("../../components/AppSidebar", () => ({ default: () => null }));

// A stand-in for Google Identity Services: records initialize/renderButton,
// and lets the test play "the user picked their Google account".
let gsi;
beforeEach(() => {
  gsi = {
    initialize: vi.fn((options) => (gsi.options = options)),
    renderButton: vi.fn((el) => {
      el.innerHTML = "<button>Continue with Google</button>";
    })
  };
  window.google = { accounts: { id: gsi } };
});

afterEach(() => {
  delete window.google;
  vi.clearAllMocks();
});

describe("Sign in with Google", () => {
  it("isn't shown when the server has it turned off", async () => {
    getProviders.mockResolvedValue({ google: null });
    renderWithApp(<Login />, { path: "/login" });

    await waitFor(() => expect(getProviders).toHaveBeenCalled());
    expect(gsi.renderButton).not.toHaveBeenCalled();
    expect(screen.queryByText("or with email")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("draws Google's button with the server's client id, and signs in with the credential", async () => {
    getProviders.mockResolvedValue({ google: "client-id.apps.googleusercontent.com" });
    googleSignIn.mockResolvedValue({ user: { id: "u1", username: "asha", email: "asha@example.test", hasPassword: false } });
    renderWithApp(<Login />, { path: "/login" });

    await waitFor(() => expect(screen.getByText("or with email")).toBeVisible());
    expect(gsi.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: "client-id.apps.googleusercontent.com" }));
    expect(gsi.renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ text: "continue_with" }));

    await act(() => gsi.options.callback({ credential: "google-id-token" }));

    expect(googleSignIn).toHaveBeenCalledWith("google-id-token");
    expect(await screen.findByText("navigated away")).toBeInTheDocument();
  });

  it("shows why Google sign-in failed and stays on the page", async () => {
    getProviders.mockResolvedValue({ google: "client-id" });
    googleSignIn.mockRejectedValue({ response: { data: { message: "Your Google account's email isn't verified." } } });
    renderWithApp(<Login />, { path: "/login" });

    await screen.findByText("or with email");
    await act(() => gsi.options.callback({ credential: "token" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("isn't verified");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("Account page for a Google account without a password", () => {
  const GOOGLE_USER = { id: "u1", username: "asha", email: "asha@example.test", hasPassword: false };

  it("offers to set a password instead of changing one", () => {
    renderWithApp(<Account />, { path: "/account", user: GOOGLE_USER });

    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(screen.getByRole("link", { name: "Set a password" })).toHaveAttribute("href", "/forgot-password");
  });

  it("confirms deleting the account with the email address", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteAccount.mockRejectedValue({ response: { data: { message: "That isn't your account's email address." } } });
    renderWithApp(<Account />, { path: "/account", user: GOOGLE_USER });

    await userEvent.type(screen.getByLabelText("Type your email (asha@example.test) to confirm"), "asha@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(deleteAccount).toHaveBeenCalledWith({ email: "asha@example.test" });
  });

  it("password accounts keep the change-password form and confirm deletion with the password", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    deleteAccount.mockRejectedValue({ response: { data: { message: "Password is incorrect." } } });
    renderWithApp(<Account />, { path: "/account", user: { ...GOOGLE_USER, hasPassword: true } });

    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Password"), "secret-123");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(deleteAccount).toHaveBeenCalledWith({ password: "secret-123" });
  });
});
