import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./Login";
import { login } from "../services/auth.api";
import { renderWithApp } from "../../../test/renderWithApp";

vi.mock("../services/auth.api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn()
}));

const fillAndSubmit = async (email, password) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
};

beforeEach(() => {
  login.mockReset();
});

describe("Login page", () => {
  it("shows the server's message and keeps the typed email", async () => {
    login.mockRejectedValue({
      response: { data: { message: "Too many sign-in attempts for this account. Try again in 15 minutes." } }
    });
    renderWithApp(<Login />, { path: "/login" });

    await fillAndSubmit("ana@example.test", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 15 minutes.");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.test");
  });

  it("falls back to a friendly message when the server can't be reached", async () => {
    login.mockRejectedValue(new Error("Network Error"));
    renderWithApp(<Login />, { path: "/login" });

    await fillAndSubmit("ana@example.test", "pw");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });

  it("goes to the dashboard after a successful sign-in", async () => {
    login.mockResolvedValue({ user: { id: "1", username: "ana", email: "ana@example.test" } });
    renderWithApp(<Login />, { path: "/login" });

    await fillAndSubmit("ana@example.test", "right-password");
    expect(await screen.findByText("navigated away")).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith("ana@example.test", "right-password");
  });
});
