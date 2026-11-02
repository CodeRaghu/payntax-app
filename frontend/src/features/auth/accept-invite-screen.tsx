"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAcceptInvitation, useInvitationPreview } from "@/api/hooks/auth";
import { AuthLayout } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { ErrorState, Loading } from "@/components/states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyServerErrors } from "@/lib/forms";

import { passwordRule } from "./signup-screen";

const schema = z.object({ full_name: z.string().trim().min(1, "Enter your name."), password: passwordRule });
type Values = z.infer<typeof schema>;

/** A preparer joins a firm from an owner's invitation (REQ-ACC-003). */
export function AcceptInviteScreen({ token }: { token: string }) {
  const router = useRouter();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation(token);
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  if (preview.isPending) return <Loading />;
  if (preview.isError) return <ErrorState error={preview.error} />;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await accept.mutateAsync(values);
      router.replace("/mfa");
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["full_name", "password"]));
    }
  });

  return (
    <AuthLayout
      title={`Join ${preview.data.firm_name}`}
      subtitle={`You were invited as ${preview.data.role === "owner" ? "an owner" : "a preparer"} (${preview.data.email}).`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <FormField id="full_name" label="Your name" error={formState.errors.full_name?.message}>
          <Input id="full_name" autoComplete="name" {...register("full_name")} />
        </FormField>
        <FormField id="password" label="Choose a password" error={formState.errors.password?.message} hint="At least 12 characters.">
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Join firm
        </Button>
      </form>
    </AuthLayout>
  );
}
