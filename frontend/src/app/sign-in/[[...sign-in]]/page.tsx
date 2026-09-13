import { SignIn } from '@clerk/nextjs';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { notionClerkAppearance } from '@/lib/notion-theme';

export default function SignInPage() {
  return (
    <AuthPageShell mode="sign-in">
      <SignIn
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={notionClerkAppearance}
      />
    </AuthPageShell>
  );
}
