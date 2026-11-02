import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seed, signIn } from "@/mocks/db";
import { renderWithApi } from "@/test/render";

import { ReviewScreen } from "./review-screen";

describe("ReviewScreen (SCR-08)", () => {
  beforeEach(() => {
    seed();
    signIn();
    db.session.mfa_verified = true;
  });

  it("blocks 'Mark reviewed' until every flagged field is resolved", async () => {
    const doc = db.documents[0];
    renderWithApi(<ReviewScreen returnId={doc.tax_return} documentId={doc.id} />);

    const markReviewed = await screen.findByRole("button", { name: /Mark reviewed/ });
    expect(markReviewed).toBeDisabled();
    expect(screen.getByText(/2 fields need attention/)).toBeInTheDocument();

    // Box 4 fails the 6.2% rule: correct it.
    const box4 = screen.getByLabelText("Box 4 Social security tax withheld");
    expect(screen.getByText(/Box 4 should be 6.2% of Box 3/)).toBeInTheDocument();
    await userEvent.clear(box4);
    await userEvent.type(box4, "5,270.00{Enter}");

    // Box 1 is low confidence: confirm it.
    const box1Row = screen.getByLabelText("Box 1 Wages, tips, other comp.").closest("li")!;
    await userEvent.click(within(box1Row).getByRole("button", { name: "Value is correct" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Mark reviewed/ })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /Mark reviewed/ }));
    expect(await screen.findByText(/Reviewed. This document feeds the return./)).toBeInTheDocument();
    expect(screen.getByText("Extracted as", { exact: false })).toHaveTextContent("5,720.00");
  });

  it("masks the SSN until revealed", async () => {
    const doc = db.documents[0];
    renderWithApi(<ReviewScreen returnId={doc.tax_return} documentId={doc.id} />);
    const ssn = await screen.findByLabelText("Employee SSN (a)");
    expect(ssn).toHaveAttribute("readonly");
  });
});
