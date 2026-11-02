import { Suspense } from "react";

import { Loading } from "@/components/states";
import { AcceptInviteScreen } from "@/features/auth/accept-invite-screen";

export const metadata = { title: "Join your firm" };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInviteScreen token={token} />;
}

export default function InvitePage(props: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Invite params={props.params} />
    </Suspense>
  );
}
