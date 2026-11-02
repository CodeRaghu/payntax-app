"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLogin } from "@/api/hooks/auth";
import { AuthLayout } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { homeFor } from "@/components/session-gate";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyServerErrors } from "@/lib/forms";

const schema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});
type Values = z.infer<typeof schema>;

/** SCR-01 Log in */
export function LoginScreen() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const login = useLogin();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, setError, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      const session = await login.mutateAsync(values);
      const home = homeFor(session);
      router.replace(home === "/clients" && next?.startsWith("/") ? next : home);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["email", "password"]));
    }
  });

  return (
    <AuthLayout title="Sign in" subtitle="Tax prep for solo CPAs.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <FormField id="email" label="Email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
        </FormField>
        <FormField id="password" label="Password" error={formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!formState.errors.password}
            {...register("password")}
          />
        </FormField>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
        <p className="text-center text-sm text-slate-500">
          New to PayNTax?{" "}
          <Link href="/signup" className="text-blue-700 hover:underline">
            Create your firm
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
