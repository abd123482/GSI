import { SignUp } from '@clerk/nextjs';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { warpAuthAppearance } from '@/lib/warp-theme';

export default function SignUpPage() {
  return (
    <AuthPageShell mode="sign-up">
      <SignUp
        signInUrl="/sign-in"
        forceRedirectUrl="/"
        appearance={warpAuthAppearance}
      />
    </AuthPageShell>
  );
}
