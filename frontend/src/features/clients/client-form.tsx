"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FILING_STATUS_LABELS, type Client, type ClientInput, type FilingStatus } from "@/api/types";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { applyServerErrors } from "@/lib/forms";

const filingStatuses = Object.keys(FILING_STATUS_LABELS) as [FilingStatus, ...FilingStatus[]];

const schema = z.object({
  first_name: z.string().trim().min(1, "Required."),
  last_name: z.string().trim().min(1, "Required."),
  email: z.union([z.literal(""), z.email("Enter a valid email.")]),
  phone: z.string().trim(),
  ssn: z.union([z.literal(""), z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, "Use the format 123-45-6789.")]),
  filing_status: z.enum(filingStatuses),
  street: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim().length(2, "Use the 2-letter code."),
  zip_code: z.union([z.literal(""), z.string().regex(/^\d{5}(-\d{4})?$/, "Use 5 digits.")]),
  notes: z.string(),
});
type Values = z.infer<typeof schema>;
const FIELDS = Object.keys(schema.shape);

/** Shared by "new client" and SCR-05 edit. On edit, an empty SSN means "leave unchanged". */
export function ClientForm({
  client,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  client?: Client;
  submitLabel: string;
  onSubmit: (values: ClientInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: client?.first_name ?? "",
      last_name: client?.last_name ?? "",
      email: client?.email ?? "",
      phone: client?.phone ?? "",
      ssn: "",
      filing_status: client?.filing_status ?? "single",
      street: client?.street ?? "",
      city: client?.city ?? "",
      state: client?.state ?? "TX",
      zip_code: client?.zip_code ?? "",
      notes: client?.notes ?? "",
    },
  });
  const err = formState.errors;

  const submit = handleSubmit(async ({ ssn, ...values }) => {
    setFormError(undefined);
    try {
      await onSubmit(ssn || !client ? { ...values, ssn } : values);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    }
  });

  const field = (name: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <FormField id={name} label={label} error={err[name]?.message} hint={hint}>
      <Input id={name} aria-invalid={!!err[name]} {...props} {...register(name)} />
    </FormField>
  );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("first_name", "First name", { autoComplete: "off" })}
        {field("last_name", "Last name", { autoComplete: "off" })}
        {field(
          "ssn",
          "SSN",
          { autoComplete: "off", inputMode: "numeric", placeholder: client ? client.ssn_masked : "123-45-6789" },
          client ? "Leave blank to keep the current SSN. Stored encrypted." : "Stored encrypted.",
        )}
        <FormField id="filing_status" label="Filing status" error={err.filing_status?.message}>
          <Select id="filing_status" {...register("filing_status")}>
            {filingStatuses.map((value) => (
              <option key={value} value={value}>
                {FILING_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </FormField>
        {field("email", "Email", { type: "email" })}
        {field("phone", "Phone", { type: "tel" })}
        <div className="sm:col-span-2">{field("street", "Street address")}</div>
        {field("city", "City")}
        <div className="grid grid-cols-2 gap-4">
          {field("state", "State", { maxLength: 2 })}
          {field("zip_code", "ZIP", { inputMode: "numeric" })}
        </div>
        <div className="sm:col-span-2">
          <FormField id="notes" label="Notes" error={err.notes?.message}>
            <Textarea id="notes" {...register("notes")} />
          </FormField>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={formState.isSubmitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
