"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useLogout, useMfaSetup, useMfaVerify, useSession } from "@/api/hooks/auth";
import { ApiError } from "@/api/client";
import { AuthLayout } from "@/components/app-shell";
import { homeFor } from "@/components/session-gate";
import { Loading } from "@/components/states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** SCR-02 MFA setup (first sign-in) and challenge (every sign-in). REQ-ACC-002. */
export function MfaScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const setup = useMfaSetup();
  const verify = useMfaVerify();
  const logout = useLogout();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const enrolling = session ? !session.mfa_enrolled : false;
  const started = useRef(false);

  useEffect(() => {
    if (enrolling && !started.current) {
      started.current = true;
      setup.mutate();
    }
  }, [enrolling, setup]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      const next = await verify.mutateAsync(code);
      router.replace(homeFor(next));
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors.code?.join(" ") ?? err.message) : "Try again.");
      setCode("");
    }
  }

  if (!session) return <Loading />;

  return (
    <AuthLayout
      title={enrolling ? "Set up two-factor sign-in" : "Enter your sign-in code"}
      subtitle={
        enrolling
          ? "Required for everyone who can see client data (IRS Pub 4557)."
          : "Open your authenticator app and enter the 6-digit code."
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {enrolling && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              1. Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy).
            </p>
            {setup.data ? (
              <>
                <div
                  className="mx-auto h-44 w-44 [&_svg]:h-full [&_svg]:w-full"
                  role="img"
                  aria-label="QR code for your authenticator app"
                  dangerouslySetInnerHTML={{ __html: setup.data.qr_svg }}
                />
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer">Can&apos;t scan? Enter this key instead</summary>
                  <code className="mt-1 block break-all rounded bg-slate-100 p-2 font-mono">{setup.data.secret}</code>
                </details>
              </>
            ) : setup.isError ? (
              <Alert tone="danger">{setup.error.message}</Alert>
            ) : (
              <Loading label="Preparing your code…" />
            )}
            <p className="text-sm text-slate-700">2. Enter the 6-digit code the app shows.</p>
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center font-mono text-lg tracking-[0.5em]"
          />
        </div>
        <Button type="submit" className="w-full" disabled={code.length !== 6} loading={verify.isPending}>
          Verify
        </Button>
        <Button
          type="button"
          variant="link"
          className="w-full"
          onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
        >
          Use a different account
        </Button>
      </form>
    </AuthLayout>
  );
}
