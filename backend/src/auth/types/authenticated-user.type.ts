export interface AuthenticatedUser {
  userId: string;
  clerkUserId: string;
  userName: string | null;
  userEmail: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
  status: string | null;
  isAdmin?: boolean;
}
