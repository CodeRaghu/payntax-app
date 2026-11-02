"use client";

import { Copy } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/api/hooks/auth";
import { usePortal, useSubscription } from "@/api/hooks/billing";
import {
  useFirm,
  useFirmUsers,
  useInvitations,
  useInvite,
  useRevokeInvitation,
  useUpdateFirm,
  useUpdateFirmUser,
} from "@/api/hooks/firm";
import type { Role } from "@/api/types";
import { ErrorState, Loading, PageHeader } from "@/components/states";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

/** SCR-10 Firm settings: firm profile, users and roles (REQ-ACC-003), billing (REQ-BIL-003). */
export function FirmSettingsScreen() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";
  const fakePortal = useSearchParams().get("portal") === "fake";

  return (
    <>
      <PageHeader title="Firm settings" />
      {fakePortal && (
        <Alert tone="info" className="mb-6">
          Development billing portal: with Stripe connected, owners manage cards and invoices in Stripe&apos;s portal.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <FirmCard isOwner={isOwner} />
        <BillingCard isOwner={isOwner} />
        <div className="lg:col-span-2">
          <UsersCard isOwner={isOwner} currentUserId={session?.user?.id} />
        </div>
      </div>
    </>
  );
}

function FirmCard({ isOwner }: { isOwner: boolean }) {
  const firm = useFirm();
  const update = useUpdateFirm();
  const [name, setName] = useState<string>();

  if (firm.isPending) return <Loading />;
  if (firm.isError) return <ErrorState error={firm.error} />;
  const value = name ?? firm.data.name;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firm</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(value.trim(), { onSuccess: () => setName(undefined) });
          }}
        >
          <Label htmlFor="firm-name">Firm name</Label>
          <Input id="firm-name" value={value} disabled={!isOwner} onChange={(e) => setName(e.target.value)} />
          {update.isError && <p className="text-xs text-red-700">{update.error.message}</p>}
          {isOwner && (
            <Button type="submit" disabled={!value.trim() || value === firm.data.name} loading={update.isPending}>
              Save
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function BillingCard({ isOwner }: { isOwner: boolean }) {
  const subscription = useSubscription();
  const portal = usePortal();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Payments are handled by Stripe. We never see card numbers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {subscription.isPending ? (
          <Loading />
        ) : subscription.isError ? (
          <p className="text-slate-500">No subscription.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-slate-500">Plan</dt>
            <dd className="capitalize">{subscription.data.plan}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd>
              <Badge tone={subscription.data.status === "past_due" ? "danger" : "success"}>{subscription.data.status}</Badge>
            </dd>
            {subscription.data.trial_ends_at && (
              <>
                <dt className="text-slate-500">Trial ends</dt>
                <dd>{formatDateTime(subscription.data.trial_ends_at)}</dd>
              </>
            )}
          </dl>
        )}
        {isOwner && (
          <Button
            variant="secondary"
            loading={portal.isPending}
            onClick={() => portal.mutate(undefined, { onSuccess: ({ url }) => window.location.assign(url) })}
          >
            Manage billing
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function UsersCard({ isOwner, currentUserId }: { isOwner: boolean; currentUserId?: string }) {
  const users = useFirmUsers();
  const updateUser = useUpdateFirmUser();
  const invitations = useInvitations(isOwner);
  const invite = useInvite();
  const revoke = useRevokeInvitation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("preparer");
  const [copied, setCopied] = useState<string>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Owners manage users, billing and the audit log. Preparers work on clients and returns.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {users.isPending ? (
          <Loading />
        ) : users.isError ? (
          <ErrorState error={users.error} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>MFA</Th>
                <Th>Last sign-in</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((user) => {
                const self = user.id === currentUserId;
                return (
                  <tr key={user.id} className={user.is_active ? "" : "text-slate-400"}>
                    <Td>{user.full_name || "—"}</Td>
                    <Td>{user.email}</Td>
                    <Td>
                      {isOwner && !self ? (
                        <Select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          className="h-8 w-32"
                          onChange={(e) => updateUser.mutate({ id: user.id, role: e.target.value as Role })}
                        >
                          <option value="owner">Owner</option>
                          <option value="preparer">Preparer</option>
                        </Select>
                      ) : (
                        <span className="capitalize">{user.role}</span>
                      )}
                    </Td>
                    <Td>{user.mfa_enrolled ? <Badge tone="success">On</Badge> : <Badge tone="warning">Not set up</Badge>}</Td>
                    <Td>{formatDateTime(user.last_login)}</Td>
                    <Td className="text-right">
                      {isOwner && !self && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateUser.mutate({ id: user.id, is_active: !user.is_active })}
                        >
                          {user.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {updateUser.isError && <Alert tone="danger">{updateUser.error.message}</Alert>}

        {isOwner && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold">Invite someone</h3>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate({ email, role }, { onSuccess: () => setEmail("") });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-72" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-role">Role</Label>
                <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-36">
                  <option value="preparer">Preparer</option>
                  <option value="owner">Owner</option>
                </Select>
              </div>
              <Button type="submit" loading={invite.isPending}>
                Send invite
              </Button>
            </form>
            {invite.isError && <Alert tone="danger">{invite.error.message}</Alert>}
            {invitations.data && invitations.data.length > 0 && (
              <ul className="space-y-2 text-sm">
                {invitations.data.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2">
                    <span className="font-medium">{inv.email}</span>
                    <Badge>{inv.role}</Badge>
                    <span className="text-xs text-slate-500">expires {formatDateTime(inv.expires_at)}</span>
                    <div className="ml-auto flex gap-1">
                      {inv.invite_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(inv.invite_url!);
                            setCopied(inv.id);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden /> {copied === inv.id ? "Copied" : "Copy link"}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => revoke.mutate(inv.id)}>
                        Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500">Until email delivery is set up, copy the invite link and send it yourself.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
