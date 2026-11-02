"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/api/hooks/auth";
import { homeFor } from "@/components/session-gate";
import { Loading } from "@/components/states";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (session) router.replace(homeFor(session));
  }, [session, router]);
  return <Loading />;
}
