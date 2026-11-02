/** MSW handlers implementing contract/openapi.yaml against the in-memory db. */
import { http, HttpResponse, type JsonBodyType } from "msw";

import type { components } from "@/api/schema";

import {
  MOCK_MFA_CODE,
  addClient,
  addDocument,
  addReturn,
  applyRules,
  audit,
  db,
  form1040,
  publicClient,
  refreshReturn,
  seed,
  signIn,
} from "./db";

type Writable<T> = T extends readonly (infer U)[]
  ? Writable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Writable<T[K]> }
    : T;
type S = { [K in keyof components["schemas"]]: Writable<components["schemas"][K]> };

const json = <T extends JsonBodyType>(body: T, status = 200) => HttpResponse.json(body, { status });
const error = (status: number, detail: string, errors: Record<string, string[]> = {}) =>
  HttpResponse.json({ detail, errors }, { status });
const notFound = () => error(404, "Not found.");
const page = <T,>(results: T[], url: URL) => {
  const number = Number(url.searchParams.get("page") ?? 1);
  return { count: results.length, next: null, previous: null, results: results.slice((number - 1) * 25, number * 25) };
};

/** Mirrors IsMfaVerified + HasActiveSubscription. */
function guard(): Response | undefined {
  if (!db.session.authenticated || !db.session.mfa_verified) return error(403, "Multi-factor authentication is required.");
  if (!["trialing", "active", "past_due"].includes(db.subscription.status)) return error(403, "An active subscription is required.");
  return undefined;
}

const MOCK_QR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><path d="M1 1h3v3H1zM6 1h3v3H6zM1 6h3v3H1zM6 6h1v1H6zM8 8h1v1H8z" fill="#000"/></svg>';

const PDF =
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

export const handlers = [
  /* --------------------------------------------------------------------------- auth --- */
  http.get("/api/auth/session", () => {
    seed();
    db.session.subscription_status = db.subscription.status;
    return json(db.session);
  }),
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as S["LoginRequest"];
    const user = db.users.find((u) => u.email === body.email.toLowerCase());
    if (!user) return error(400, "Email or password is incorrect.");
    signIn();
    db.session.user = user;
    audit("auth.login");
    return json(db.session);
  }),
  http.post("/api/auth/signup", async ({ request }) => {
    const body = (await request.json()) as S["SignupRequest"];
    if (db.users.some((u) => u.email === body.email)) {
      return error(400, "Please correct the highlighted fields.", { email: ["An account with this email already exists."] });
    }
    db.firm.name = body.firm_name;
    const user: S["User"] = {
      id: crypto.randomUUID(),
      email: body.email,
      full_name: body.full_name,
      role: "owner",
      is_active: true,
      mfa_enrolled: false,
      last_login: null,
    };
    db.users.push(user);
    db.subscription.status = "canceled";
    db.session = { authenticated: true, mfa_enrolled: false, mfa_verified: false, subscription_status: null, user, firm: db.firm };
    return json(db.session, 201);
  }),
  http.post("/api/auth/logout", () => {
    db.session = { ...db.session, authenticated: false, mfa_verified: false, user: null, firm: null };
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/api/auth/mfa/setup", () =>
    json<S["MfaSetup"]>({
      otpauth_url: "otpauth://totp/PayNTax:mock?secret=MOCKSECRET",
      secret: "MOCKSECRETMOCKSECRET",
      qr_svg: MOCK_QR,
    }),
  ),
  http.post("/api/auth/mfa/verify", async ({ request }) => {
    const { code } = (await request.json()) as S["MfaVerifyRequest"];
    if (code !== MOCK_MFA_CODE) return error(400, "Please correct the highlighted fields.", { code: [`Mock API: use ${MOCK_MFA_CODE}.`] });
    db.session.mfa_enrolled = true;
    db.session.mfa_verified = true;
    if (db.session.user) db.session.user.mfa_enrolled = true;
    db.session.subscription_status = db.subscription.status === "canceled" ? null : db.subscription.status;
    return json(db.session);
  }),
  http.get("/api/auth/invitations/:token", ({ params }) => {
    const invitation = db.invitations.find((i) => i.invite_url?.endsWith(String(params.token)));
    if (!invitation) return error(400, "This invitation has expired or was already used.");
    return json<S["InvitationPreview"]>({ email: invitation.email, firm_name: db.firm.name, role: invitation.role ?? "preparer" });
  }),

  /* ------------------------------------------------------------------------ billing --- */
  http.get("/api/billing/plans", () =>
    json<S["Plan"][]>([
      { id: "solo", name: "Solo", monthly_price_cents: 4900, description: "One CPA, unlimited clients.", features: ["1 user", "W-2 and pay stub extraction", "Form 1040 PDF"], trial_days: 14 },
      { id: "practice", name: "Practice", monthly_price_cents: 12900, description: "A small firm with preparers.", features: ["Up to 5 users", "Everything in Solo", "Audit log export"], trial_days: 14 },
    ]),
  ),
  http.get("/api/billing/subscription", () => (db.subscription.status === "canceled" ? notFound() : json(db.subscription))),
  http.post("/api/billing/checkout", async ({ request }) => {
    const { plan } = (await request.json()) as S["CheckoutRequestRequest"];
    return json<S["Redirect"]>({ url: `${location.origin}/billing/fake-checkout?session=mock-${plan}` });
  }),
  http.post("/api/billing/portal", () => json<S["Redirect"]>({ url: `${location.origin}/settings?portal=fake` })),
  http.post("/api/billing/fake/complete", async ({ request }) => {
    const { session } = (await request.json()) as S["FakeCompleteRequest"];
    db.subscription = { plan: session.replace("mock-", ""), status: "trialing", trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(), current_period_end: null };
    db.session.subscription_status = "trialing";
    return json(db.subscription);
  }),

  /* ------------------------------------------------------------------------ clients --- */
  http.get("/api/clients", ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const rows = db.clients
      .filter((c) => !search || `${c.full_name} ${c.email}`.toLowerCase().includes(search) || c.ssn.endsWith(search))
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
      .map(publicClient);
    return json(page(rows, url));
  }),
  http.post("/api/clients", async ({ request }) => {
    const denied = guard();
    if (denied) return denied;
    const body = (await request.json()) as S["ClientRequest"] & { ssn?: string };
    const client = addClient({ ...body, ssn: body.ssn ?? "" });
    audit("client.create", "client", client.id);
    return json(publicClient(client), 201);
  }),
  http.get("/api/clients/:id", ({ params }) => {
    const client = db.clients.find((c) => c.id === params.id);
    if (!client) return notFound();
    audit("client.view", "client", client.id);
    return json(publicClient(client));
  }),
  http.patch("/api/clients/:id", async ({ params, request }) => {
    const client = db.clients.find((c) => c.id === params.id);
    if (!client) return notFound();
    const body = (await request.json()) as Partial<S["ClientRequest"]> & { ssn?: string };
    Object.assign(client, body, { updated_at: new Date().toISOString() });
    client.full_name = `${client.first_name} ${client.last_name}`;
    client.ssn_masked = client.ssn ? `***-**-${client.ssn.slice(-4)}` : "";
    audit("client.update", "client", client.id, { fields: Object.keys(body) });
    return json(publicClient(client));
  }),
  http.post("/api/clients/:id/reveal-ssn", ({ params }) => {
    const client = db.clients.find((c) => c.id === params.id);
    if (!client) return notFound();
    audit("client.ssn_revealed", "client", client.id);
    return json<S["RevealSsn"]>({ ssn: client.ssn });
  }),

  /* ------------------------------------------------------------------------ returns --- */
  http.get("/api/returns", ({ request }) => {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("client");
    const rows = db.returns.filter((r) => !clientId || r.client === clientId);
    rows.forEach((r) => refreshReturn(r.id));
    return json(page(rows, url));
  }),
  http.post("/api/returns", async ({ request }) => {
    const body = (await request.json()) as S["TaxReturnRequest"];
    if (db.returns.some((r) => r.client === body.client && r.tax_year === body.tax_year)) {
      return error(400, "This client already has a return for that year.");
    }
    const taxReturn = addReturn(body.client, body.tax_year);
    audit("return.create", "taxreturn", taxReturn.id);
    return json(taxReturn, 201);
  }),
  http.get("/api/returns/:id", ({ params }) => {
    const taxReturn = db.returns.find((r) => r.id === params.id);
    if (!taxReturn) return notFound();
    refreshReturn(taxReturn.id);
    return json(taxReturn);
  }),
  http.patch("/api/returns/:id", async ({ params, request }) => {
    const taxReturn = db.returns.find((r) => r.id === params.id);
    if (!taxReturn) return notFound();
    const { status } = (await request.json()) as { status: S["ReturnStatusEnum"] };
    taxReturn.status = status;
    refreshReturn(taxReturn.id);
    return json(taxReturn);
  }),

  /* ---------------------------------------------------------------------- documents --- */
  http.get("/api/documents", ({ request }) => {
    const returnId = new URL(request.url).searchParams.get("tax_return");
    refreshReturn(returnId ?? "");
    return json(db.documents.filter((d) => d.tax_return === returnId).map(({ extracted_fields: _f, file_url: _u, ...d }) => d));
  }),
  http.post("/api/documents", async ({ request }) => {
    const body = (await request.json()) as S["UploadRequestRequest"];
    if (body.size > 20 * 1024 * 1024) return error(400, "Please correct the highlighted fields.", { size: ["Files must be 20 MB or smaller."] });
    const doc = addDocument(body.tax_return, body.filename, body.content_type, body.size);
    return json<S["UploadResponse"]>(
      { document: doc, upload: { url: `${location.origin}/mock-storage/${doc.id}`, method: "PUT", headers: { "Content-Type": body.content_type } } },
      201,
    );
  }),
  http.put("/mock-storage/:id", async ({ params, request }) => {
    const doc = db.documents.find((d) => d.id === params.id);
    if (doc) doc.file_url = URL.createObjectURL(await request.blob());
    return new HttpResponse(null, { status: 200 });
  }),
  http.post("/api/documents/:id/complete", ({ params }) => {
    const doc = db.documents.find((d) => d.id === params.id);
    if (!doc) return notFound();
    doc.status = "uploaded";
    doc.processedAt = Date.now();
    refreshReturn(doc.tax_return);
    return json(doc);
  }),
  http.get("/api/documents/:id", ({ params }) => {
    const doc = db.documents.find((d) => d.id === params.id);
    if (!doc) return notFound();
    refreshReturn(doc.tax_return);
    audit("document.view", "document", doc.id);
    return json<S["DocumentDetail"]>({ ...doc, file_url: doc.file_url ?? `data:application/pdf;base64,${btoa(PDF)}` });
  }),
  http.delete("/api/documents/:id", ({ params }) => {
    db.documents = db.documents.filter((d) => d.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/api/documents/:id/retry", ({ params }) => {
    const doc = db.documents.find((d) => d.id === params.id);
    if (!doc) return notFound();
    doc.status = "uploaded";
    doc.processedAt = Date.now();
    return json(doc);
  }),
  http.patch("/api/documents/:id/fields/:fieldId", async ({ params, request }) => {
    const doc = db.documents.find((d) => d.id === params.id);
    const field = doc?.extracted_fields.find((f) => f.id === params.fieldId);
    if (!doc || !field) return notFound();
    const body = (await request.json()) as S["PatchedFieldUpdateRequest"];
    if (doc.status === "reviewed") {
      doc.status = "ready_for_review";
      doc.reviewed_at = null;
    }
    if (body.value !== undefined && body.value !== field.value) {
      field.value = body.value;
      field.corrected = true;
      field.acknowledged = false;
    }
    if (body.acknowledged !== undefined) field.acknowledged = body.acknowledged;
    applyRules(doc);
    audit("document.field_update", "document", doc.id, { field: field.name });
    return json<S["DocumentDetail"]>({ ...doc, file_url: doc.file_url ?? `data:application/pdf;base64,${btoa(PDF)}` });
  }),
  http.post("/api/documents/:id/mark-reviewed", ({ params }) => {
    const doc = db.documents.find((d) => d.id === params.id);
    if (!doc) return notFound();
    if (doc.attention_count) return error(400, `${doc.attention_count} field(s) still need attention.`);
    doc.status = "reviewed";
    doc.reviewed_at = new Date().toISOString();
    doc.reviewed_by_name = db.session.user?.full_name ?? "";
    refreshReturn(doc.tax_return);
    audit("document.reviewed", "document", doc.id);
    return json<S["DocumentDetail"]>({ ...doc, file_url: doc.file_url ?? `data:application/pdf;base64,${btoa(PDF)}` });
  }),
  http.post("/api/documents/:id/reveal-sensitive", ({ params }) => {
    const doc = db.documents.find((d) => d.id === params.id);
    if (!doc) return notFound();
    const values = Object.fromEntries(doc.extracted_fields.filter((f) => f.sensitive).map((f) => [f.name, f.value]));
    audit("document.sensitive_revealed", "document", doc.id);
    return json<S["SensitiveValues"]>({ values });
  }),

  /* ---------------------------------------------------------------------- form 1040 --- */
  http.get("/api/returns/:id/form-1040", ({ params }) =>
    db.returns.some((r) => r.id === params.id) ? json(form1040(String(params.id))) : notFound(),
  ),
  http.patch("/api/returns/:id/form-1040/lines/:line", async ({ params, request }) => {
    const { value } = (await request.json()) as S["PatchedFormLineUpdateRequest"];
    const overrides = (db.formOverrides[String(params.id)] ??= {});
    if (value === null || value === undefined) delete overrides[String(params.line)];
    else overrides[String(params.line)] = value;
    audit("form1040.line_update", "taxreturn", String(params.id), { line: params.line });
    return json(form1040(String(params.id)));
  }),
  http.get("/api/returns/:id/form-1040.pdf", () =>
    new HttpResponse(PDF, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="1040-mock.pdf"' } }),
  ),

  /* --------------------------------------------------------------------------- firm --- */
  http.get("/api/firm", () => json(db.firm)),
  http.patch("/api/firm", async ({ request }) => {
    Object.assign(db.firm, (await request.json()) as S["PatchedFirmRequest"]);
    return json(db.firm);
  }),
  http.get("/api/firm/users", () => json(db.users)),
  http.patch("/api/firm/users/:id", async ({ params, request }) => {
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return notFound();
    if (user.id === db.session.user?.id) return error(400, "You can't change your own role or deactivate yourself.");
    Object.assign(user, (await request.json()) as S["PatchedFirmUserUpdateRequest"]);
    return json(user);
  }),
  http.get("/api/firm/invitations", () => json(db.invitations)),
  http.post("/api/firm/invitations", async ({ request }) => {
    const body = (await request.json()) as S["InvitationRequest"];
    const token = crypto.randomUUID();
    const invitation: S["Invitation"] = {
      id: crypto.randomUUID(),
      email: body.email,
      role: body.role ?? "preparer",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      accepted_at: null,
      created_at: new Date().toISOString(),
      invite_url: `${location.origin}/invite/${token}`,
    };
    db.invitations.push(invitation);
    audit("firm.invite", "invitation", invitation.id);
    return json(invitation, 201);
  }),
  http.delete("/api/firm/invitations/:id", ({ params }) => {
    db.invitations = db.invitations.filter((i) => i.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  /* -------------------------------------------------------------------------- audit --- */
  http.get("/api/audit-events", ({ request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "";
    return json(page(db.audit.filter((e) => e.action.startsWith(action)), url));
  }),
];
