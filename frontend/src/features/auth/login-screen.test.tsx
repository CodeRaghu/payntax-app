import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithApi } from "@/test/render";

import { LoginScreen } from "./login-screen";

describe("LoginScreen (SCR-01)", () => {
  it("validates before calling the API", async () => {
    renderWithApi(<LoginScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
  });

  it("shows the API's error message", async () => {
    renderWithApi(<LoginScreen />);
    await userEvent.type(screen.getByLabelText("Email"), "nobody@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "whatever-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });
});
