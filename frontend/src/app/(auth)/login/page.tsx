import { SessionGate } from "@/components/session-gate";
import { LoginScreen } from "@/features/auth/login-screen";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <SessionGate gate="guest">
      <LoginScreen />
    </SessionGate>
  );
}
