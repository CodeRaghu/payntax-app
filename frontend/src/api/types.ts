/** Domain types for screens, derived from the generated contract. Import these, not schema.d.ts. */
import type { components } from "./schema";

type Schemas = components["schemas"];

export type Session = Schemas["Session"];
export type User = Schemas["User"];
export type Firm = Schemas["Firm"];
export type Role = Schemas["RoleEnum"];
export type Invitation = Schemas["Invitation"];
export type InvitationPreview = Schemas["InvitationPreview"];
export type MfaSetup = Schemas["MfaSetup"];

export type Client = Schemas["Client"];
export type ClientInput = Schemas["ClientRequest"];
export type FilingStatus = Schemas["FilingStatusEnum"];

export type TaxReturn = Schemas["TaxReturn"];
export type ReturnStatus = Schemas["ReturnStatusEnum"];

export type Document = Schemas["Document"];
export type DocumentDetail = Schemas["DocumentDetail"];
export type DocumentStatus = Schemas["DocumentStatusEnum"];
export type DocumentType = Schemas["DocumentTypeEnum"];
export type ExtractedField = Schemas["ExtractedField"];
export type UploadContentType = Schemas["ContentTypeEnum"];

export type Form1040 = Schemas["Form1040"];
export type FormLine = Schemas["FormLine"];

export type Plan = Schemas["Plan"];
export type Subscription = Schemas["Subscription"];
export type AuditEvent = Schemas["AuditEvent"];

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  married_joint: "Married filing jointly",
  married_separate: "Married filing separately",
  head_of_household: "Head of household",
  qualifying_surviving_spouse: "Qualifying surviving spouse",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  unknown: "—",
  w2: "W-2",
  pay_stub: "Pay stub",
  other: "Other",
};

export const PROCESSING_STATUSES: DocumentStatus[] = ["uploading", "uploaded", "scanning", "classifying", "extracting"];
