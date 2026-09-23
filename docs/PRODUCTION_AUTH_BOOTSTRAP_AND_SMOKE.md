# Production authentication bootstrap + smoke test

Use this only after:

- `FINAL_yacinedb_rebuild.sql` executed successfully;
- `verify_production_after_rebuild.sql` passed;
- the normal application is now intended to use `yacinedb`.

The current auth flow creates a new Clerk-backed SQL user as `PENDING`.
Therefore a newly rebuilt database needs one controlled initial ADMIN bootstrap.

## 1. Start the normal backend

PowerShell window 1:

```powershell
cd C:\Users\KS\Documents\yacineapp\somepharm-maintenance\backend
npm run start:dev
```

Do not set `DB_NAME=yacinedb_rebuild_test`.

## 2. Start the normal frontend

PowerShell window 2:

```powershell
cd C:\Users\KS\Documents\yacineapp\somepharm-maintenance\frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

## 3. Sign in once with the account that should become the first ADMIN

The app may show Forbidden/PENDING.

That is expected for the first production login.

The authenticated request creates the Clerk-linked local SQL `User` row with:

```text
userStatus = PENDING
role = null
```

Do not manually invent a Clerk user ID.

## 4. Confirm that the local user exists

From project root:

```powershell
.\scripts\list-production-auth-users.ps1
```

Find your intended admin email.

It should show roughly:

```text
Email=you@example.com | Status=PENDING | Role=- | ClerkLinked=YES
```

## 5. Bootstrap exactly that existing user

Replace only the email:

```powershell
.\scripts\bootstrap-production-admin.ps1 `
  -Email "you@example.com" `
  -Confirmation "I CONFIRM BOOTSTRAP THIS EXISTING CLERK USER AS PRODUCTION ADMIN"
```

Expected:

```text
SUCCESS: existing Clerk-linked user promoted to ACTIVE ADMIN.
Status: ACTIVE
Role: ADMIN
ADMIN BOOTSTRAP PASSED.
```

The script does not create a user and does not accept a manually invented Clerk ID.

## 6. Refresh authentication

In the browser:

```text
Sign out
Sign in again
```

The ADMIN account should now be allowed through the backend guards.

## 7. Final production smoke test

Create only small disposable test data:

```text
Stock: PROD SMOKE
Status: ACTIVE

Shelf: PROD-A
Stock: PROD SMOKE

Shelf: PROD-B
Stock: PROD SMOKE

Equipment: PROD STANDARD TEST
Type: Standard
Status: ACTIVE
```

Run:

```text
IN 1 -> PROD-A
TRANSFER 1 -> PROD-A to PROD-B
OUT 1 -> PROD-B
```

Expected final physical quantity:

```text
0
```

Also verify:

- no visible UUID/GUID;
- stock status is ACTIVE/INACTIVE only;
- movement page is top-level `/movements`;
- inactive stock rejects new allocations/movements;
- empty shelf displays `Aucun article dans cet emplacement.`

## 8. Inventory smoke

For the complete C1/C2 test, sign in once with the additional Clerk controller
accounts so their PENDING local users are created.

As ADMIN, activate them and assign appropriate roles/permissions through the app.

Then create one small inventory where C1 and C2 submit the same result.

Expected:

```text
PRIMARY_MATCH
C3 is not required
finalization succeeds
```

A C1/C2 disagreement/C3 smoke can be performed afterwards if desired.

## 9. After production smoke passes

The remaining technical phase is to establish a new Prisma migration baseline
and archive the broken historical migration chain.

Do not run:

```text
prisma db push
prisma migrate reset
prisma migrate dev
prisma migrate deploy
```

until that new baseline is prepared and validated.
