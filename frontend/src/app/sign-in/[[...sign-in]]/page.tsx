import { SignIn } from '@clerk/nextjs';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { warpAuthAppearance } from '@/lib/warp-theme';

export default function SignInPage() {
  return (
    <AuthPageShell mode="sign-in">
      <SignIn
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={warpAuthAppearance}
      />
    </AuthPageShell>
  );
}
