"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useSignup } from "@/api/hooks/auth";
import { AuthLayout } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyServerErrors } from "@/lib/forms";

export const passwordRule = z.string().min(12, "Use at least 12 characters.");

const schema = z.object({
  firm_name: z.string().trim().min(1, "Enter your firm's name."),
  full_name: z.string().trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email."),
  password: passwordRule,
});
type Values = z.infer<typeof schema>;
const FIELDS = ["firm_name", "full_name", "email", "password"];

/** SCR-01 Sign up: a CPA creates a firm (REQ-ACC-001). Next stop: MFA setup. */
export function SignupScreen() {
  const router = useRouter();
  const signup = useSignup();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const err = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await signup.mutateAsync(values);
      router.replace("/mfa");
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    }
  });

  return (
    <AuthLayout title="Create your firm" subtitle="You'll set up two-factor sign-in next.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <FormField id="firm_name" label="Firm name" error={err.firm_name?.message}>
          <Input id="firm_name" autoComplete="organization" aria-invalid={!!err.firm_name} {...register("firm_name")} />
        </FormField>
        <FormField id="full_name" label="Your name" error={err.full_name?.message}>
          <Input id="full_name" autoComplete="name" aria-invalid={!!err.full_name} {...register("full_name")} />
        </FormField>
        <FormField id="email" label="Work email" error={err.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!err.email} {...register("email")} />
        </FormField>
        <FormField id="password" label="Password" error={err.password?.message} hint="At least 12 characters.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!err.password}
            {...register("password")}
          />
        </FormField>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Create firm
        </Button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
