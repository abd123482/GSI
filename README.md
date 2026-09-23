# Direct Clerk → production ADMIN bootstrap

Use this when `list-production-auth-users.ps1` shows no local SQL users, so the
normal first authenticated request has not created the PENDING SQL row.

This script does not invent a Clerk ID.

It uses the configured `CLERK_SECRET_KEY` to find exactly one Clerk user with
the requested email, then safely creates or links that exact Clerk identity in
`yacinedb.dbo.User` and assigns:

```text
userStatus = ACTIVE
role = ADMIN
```

It stops if:
- the email does not exist in Clerk;
- multiple Clerk users match;
- an SQL email is linked to a different Clerk identity;
- the ADMIN role is missing;
- the active DB is not exactly `yacinedb`.

Run from project root:

```powershell
.\scripts\bootstrap-admin-from-clerk.ps1 `
  -Email "abdkkassl@gmail.com" `
  -Confirmation "I CONFIRM CREATE OR LINK THIS CLERK USER AS PRODUCTION ADMIN"
```

Then verify:

```powershell
.\scripts\list-production-auth-users.ps1
```

Finally sign out and sign in again in the frontend.
