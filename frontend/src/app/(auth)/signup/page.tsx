import { SessionGate } from "@/components/session-gate";
import { SignupScreen } from "@/features/auth/signup-screen";

export const metadata = { title: "Create your firm" };

export default function SignupPage() {
  return (
    <SessionGate gate="guest">
      <SignupScreen />
    </SessionGate>
  );
}
