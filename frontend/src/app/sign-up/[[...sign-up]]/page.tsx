import { SignUp } from '@clerk/nextjs';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { notionClerkAppearance } from '@/lib/notion-theme';

export default function SignUpPage() {
  return (
    <AuthPageShell mode="sign-up">
      <SignUp
        signInUrl="/sign-in"
        forceRedirectUrl="/"
        appearance={notionClerkAppearance}
      />
    </AuthPageShell>
  );
}
