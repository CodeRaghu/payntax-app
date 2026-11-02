import { SessionGate } from "@/components/session-gate";
import { MfaScreen } from "@/features/auth/mfa-screen";

export const metadata = { title: "Two-factor sign-in" };

export default function MfaPage() {
  return (
    <SessionGate gate="mfa">
      <MfaScreen />
    </SessionGate>
  );
}
