/**
 * In-memory fake backend for the mock API. Shapes come from the generated contract, so if the backend
 * changes a response, `tsc` points at the mock that needs updating. Synthetic data only.
 */
import type { components } from "@/api/schema";

/** The contract marks server-computed fields readonly; the fake server is allowed to write them. */
type Writable<T> = T extends readonly (infer U)[]
  ? Writable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Writable<T[K]> }
    : T;
type S = { [K in keyof components["schemas"]]: Writable<components["schemas"][K]> };

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export const MOCK_MFA_CODE = "123456";

const firm: S["Firm"] = { id: uuid(), name: "Demo CPA Firm", created_at: now() };
const owner: S["User"] = {
  id: uuid(),
  email: "owner@payntax.test",
  full_name: "Olivia Owner",
  role: "owner",
  is_active: true,
  mfa_enrolled: true,
  last_login: now(),
};

type ClientRow = S["Client"] & { ssn: string };
type DocRow = S["DocumentDetail"] & { processedAt?: number };

export const db = {
  session: {
    authenticated: false,
    mfa_enrolled: true,
    mfa_verified: false,
    subscription_status: "trialing",
    user: null,
    firm: null,
  } as S["Session"],
  firm,
  users: [
    owner,
    {
      id: uuid(),
      email: "preparer@payntax.test",
      full_name: "Pat Preparer",
      role: "preparer",
      is_active: true,
      mfa_enrolled: true,
      last_login: null,
    },
  ] as S["User"][],
  invitations: [] as S["Invitation"][],
  subscription: { plan: "solo", status: "trialing", trial_ends_at: now(), current_period_end: null } as S["Subscription"],
  clients: [] as ClientRow[],
  returns: [] as S["TaxReturn"][],
  documents: [] as DocRow[],
  formOverrides: {} as Record<string, Record<string, string>>,
  audit: [] as S["AuditEvent"][],
};

export function signIn() {
  db.session = {
    authenticated: true,
    mfa_enrolled: true,
    mfa_verified: false,
    subscription_status: db.subscription.status,
    user: owner,
    firm: db.firm,
  };
}

export function audit(action: string, objectType = "", objectId = "", metadata: Record<string, unknown> = {}) {
  db.audit.unshift({
    id: uuid(),
    at: now(),
    user_email: db.session.user?.email ?? null,
    action,
    object_type: objectType,
    object_id: objectId,
    metadata,
    ip_address: "127.0.0.1",
  });
}

export function addClient(input: Partial<ClientRow> & { first_name: string; last_name: string }): ClientRow {
  const ssn = input.ssn ?? "";
  const client: ClientRow = {
    id: uuid(),
    email: "",
    phone: "",
    filing_status: "single",
    street: "",
    city: "",
    state: "TX",
    zip_code: "",
    notes: "",
    ...input,
    ssn,
    full_name: `${input.first_name} ${input.last_name}`,
    ssn_masked: ssn ? `***-**-${ssn.slice(-4)}` : "",
    return_count: 0,
    created_at: now(),
    updated_at: now(),
  };
  db.clients.push(client);
  return client;
}

export function publicClient({ ssn: _ssn, ...client }: ClientRow): S["Client"] {
  return { ...client, return_count: db.returns.filter((r) => r.client === client.id).length };
}

export function addReturn(clientId: string, taxYear: number): S["TaxReturn"] {
  const client = db.clients.find((c) => c.id === clientId)!;
  const taxReturn: S["TaxReturn"] = {
    id: uuid(),
    client: clientId,
    client_name: client.full_name,
    tax_year: taxYear,
    form_type: "1040",
    status: "draft",
    document_counts: { total: 0, processing: 0, needs_attention: 0, reviewed: 0 },
    created_at: now(),
    updated_at: now(),
  };
  db.returns.push(taxReturn);
  return taxReturn;
}

/* ---------------------------------------------------------------- documents and extraction --- */

const W2: [string, string, string, string][] = [
  ["employee_ssn", "Employee SSN (a)", "ssn", "900-12-6789"],
  ["employer_ein", "Employer EIN (b)", "ein", "12-3456789"],
  ["employer_name", "Employer name (c)", "text", "Acme Corp"],
  ["employee_name", "Employee name (e)", "text", "Jane Sample"],
  ["box1_wages", "Box 1 Wages, tips, other comp.", "money", "85,000.00"],
  ["box2_federal_tax", "Box 2 Federal income tax withheld", "money", "12,410.00"],
  ["box3_ss_wages", "Box 3 Social security wages", "money", "85,000.00"],
  ["box4_ss_tax", "Box 4 Social security tax withheld", "money", "5,720.00"],
  ["box5_medicare_wages", "Box 5 Medicare wages and tips", "money", "85,000.00"],
  ["box6_medicare_tax", "Box 6 Medicare tax withheld", "money", "1,232.50"],
];

const money = (value: string) => Number(value.replace(/[,$]/g, ""));

function makeFields(docType: S["DocumentTypeEnum"]): S["ExtractedField"][] {
  if (docType !== "w2") return [];
  return W2.map(([name, label, kind, value], index) => ({
    id: uuid(),
    name,
    label,
    kind,
    value,
    original_value: value,
    confidence: name === "box1_wages" ? 0.72 : 0.97 - index * 0.002,
    low_confidence: name === "box1_wages",
    rule_issue: "",
    acknowledged: false,
    corrected: false,
    needs_attention: false,
    sensitive: name === "employee_ssn",
    bbox: null,
  }));
}

/** Same rule as the backend's validate_w2 for Box 4, enough to exercise the review screen. */
export function applyRules(doc: DocRow) {
  const byName = Object.fromEntries(doc.extracted_fields.map((f) => [f.name, f]));
  for (const field of doc.extracted_fields) field.rule_issue = "";
  if (byName.box3_ss_wages && byName.box4_ss_tax) {
    const expected = Math.round(money(byName.box3_ss_wages.value) * 0.062 * 100) / 100;
    if (Math.abs(money(byName.box4_ss_tax.value) - expected) > 1) {
      byName.box4_ss_tax.rule_issue = `Box 4 should be 6.2% of Box 3 (expected ${expected.toLocaleString("en-US", { minimumFractionDigits: 2 })}).`;
    }
  }
  for (const field of doc.extracted_fields) {
    field.low_confidence = field.confidence < 0.9 && !field.corrected;
    field.needs_attention = (field.low_confidence || !!field.rule_issue) && !field.acknowledged;
  }
  doc.attention_count = doc.extracted_fields.filter((f) => f.needs_attention).length;
  if (["needs_review", "ready_for_review"].includes(doc.status)) {
    doc.status = doc.attention_count || doc.extracted_fields.length === 0 ? "needs_review" : "ready_for_review";
  }
}

export function addDocument(returnId: string, filename: string, contentType: string, size: number): DocRow {
  const doc: DocRow = {
    id: uuid(),
    tax_return: returnId,
    filename,
    content_type: contentType,
    size,
    doc_type: "unknown",
    status: "uploading",
    error_message: "",
    attention_count: 0,
    uploaded_by_name: db.session.user?.full_name ?? "",
    reviewed_at: null,
    reviewed_by_name: "",
    created_at: now(),
    updated_at: now(),
    file_url: null,
    extracted_fields: [],
    confidence_threshold: 0.9,
  };
  db.documents.unshift(doc);
  return doc;
}

/** Simulates the worker: statuses advance over a few seconds after the upload completes. */
export function advance(doc: DocRow) {
  if (doc.processedAt === undefined || !["uploaded", "scanning", "classifying", "extracting"].includes(doc.status)) return;
  const elapsed = Date.now() - doc.processedAt;
  if (elapsed < 1000) doc.status = "scanning";
  else if (elapsed < 2000) doc.status = "classifying";
  else if (elapsed < 3000) doc.status = "extracting";
  else {
    const name = doc.filename.toLowerCase().replace(/[-_]/g, "");
    doc.doc_type = name.includes("w2") ? "w2" : name.includes("stub") || name.includes("pay") ? "pay_stub" : "other";
    doc.extracted_fields = makeFields(doc.doc_type);
    doc.status = "needs_review";
    doc.error_message = doc.doc_type === "w2" ? "" : "Mock API extracts W-2s only. Check it and mark it reviewed.";
    applyRules(doc);
  }
}

export function refreshReturn(returnId: string) {
  const taxReturn = db.returns.find((r) => r.id === returnId);
  if (!taxReturn) return;
  const docs = db.documents.filter((d) => d.tax_return === returnId);
  docs.forEach(advance);
  const processing = ["uploading", "uploaded", "scanning", "classifying", "extracting"];
  taxReturn.document_counts = {
    total: docs.length,
    processing: docs.filter((d) => processing.includes(d.status)).length,
    needs_attention: docs.filter((d) => ["needs_review", "failed"].includes(d.status)).length,
    reviewed: docs.filter((d) => d.status === "reviewed").length,
  };
  if (taxReturn.status !== "complete") {
    taxReturn.status = !docs.length
      ? "draft"
      : docs.every((d) => ["reviewed", "rejected"].includes(d.status))
        ? "ready"
        : "in_review";
  }
}

/* ---------------------------------------------------------------------------- form 1040 --- */

const STANDARD_DEDUCTION: Record<string, number> = {
  single: 16100,
  married_joint: 32200,
  married_separate: 16100,
  head_of_household: 24150,
  qualifying_surviving_spouse: 32200,
};

export function form1040(returnId: string): S["Form1040"] {
  const taxReturn = db.returns.find((r) => r.id === returnId)!;
  const client = db.clients.find((c) => c.id === taxReturn.client)!;
  const overrides = db.formOverrides[returnId] ?? {};
  const reviewed = db.documents.filter((d) => d.tax_return === returnId && d.doc_type === "w2" && d.status === "reviewed");
  const sum = (name: string) =>
    reviewed.reduce((total, d) => total + money(d.extracted_fields.find((f) => f.name === name)?.value ?? "0"), 0);

  const lines: S["FormLine"][] = [];
  const put = (line: string, label: string, section: string, editable: boolean, computed: number | null, source: S["SourceEnum"]) => {
    const override = editable ? overrides[line] : undefined;
    const value = override !== undefined ? Number(override) : computed;
    lines.push({
      line,
      label,
      section,
      editable,
      value: value === null ? null : value.toFixed(2),
      computed_value: computed === null ? null : computed.toFixed(2),
      source: override !== undefined ? "cpa" : source,
    });
    return value ?? 0;
  };
  const l1a = put("1a", "Total amount from Form(s) W-2, box 1", "Income", true, sum("box1_wages"), "w2");
  put("1z", "Add lines 1a through 1h", "Income", false, l1a, "computed");
  put("9", "Total income", "Income", false, l1a, "computed");
  const l11 = put("11", "Adjusted gross income", "Income", false, l1a, "computed");
  const l12 = put("12", "Standard deduction", "Deductions", true, STANDARD_DEDUCTION[client.filing_status ?? "single"], "computed");
  put("14", "Total deductions", "Deductions", false, l12, "computed");
  put("15", "Taxable income", "Deductions", false, Math.max(0, l11 - l12), "computed");
  const l16 = put("16", "Tax (from tax table; enter manually for now)", "Tax and payments", true, null, "missing");
  put("24", "Total tax", "Tax and payments", false, l16, "computed");
  const l25a = put("25a", "Federal income tax withheld from Form(s) W-2", "Tax and payments", true, sum("box2_federal_tax"), "w2");
  put("25d", "Total withholding", "Tax and payments", false, l25a, "computed");
  put("33", "Total payments", "Tax and payments", false, l25a, "computed");
  put("34", "Amount overpaid (refund)", "Refund or amount owed", false, Math.max(0, l25a - l16), "computed");
  put("37", "Amount you owe", "Refund or amount owed", false, Math.max(0, l16 - l25a), "computed");

  const warnings: string[] = [];
  const pending = db.documents.filter((d) => d.tax_return === returnId && !["reviewed", "rejected"].includes(d.status)).length;
  if (pending) warnings.push(`${pending} document(s) are not reviewed yet and are not included.`);
  if (!reviewed.length) warnings.push("No reviewed W-2s yet. Lines 1a and 25a are zero.");
  if (overrides["16"] === undefined) warnings.push("Enter line 16 (tax) from the IRS tax table.");
  return { tax_return: returnId, tax_year: taxReturn.tax_year, lines, warnings };
}

/* ------------------------------------------------------------------------------- seed --- */

export function seed() {
  if (db.clients.length) return;
  const jane = addClient({ first_name: "Jane", last_name: "Sample", ssn: "900-12-6789", email: "jane@example.com", city: "Austin" });
  addClient({ first_name: "Marcus", last_name: "Example", ssn: "912-34-1111", filing_status: "married_joint" });
  addClient({ first_name: "Priya", last_name: "Testcase", ssn: "923-45-2222", filing_status: "head_of_household" });
  const taxReturn = addReturn(jane.id, 2026);
  const doc = addDocument(taxReturn.id, "acme_w2.pdf", "application/pdf", 182_000);
  doc.processedAt = 0;
  doc.status = "uploaded";
  advance(doc);
  refreshReturn(taxReturn.id);
}
