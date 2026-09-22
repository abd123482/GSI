# Movement ledger test runner fix

Your application code is already healthy:

- `npx tsc --noEmit` passed.
- `npm run build` passed.

The remaining failure was only Node's ESM resolver:
`ERR_MODULE_NOT_FOUND` for `../src/lib/movement-ledger`.

Node 22 running TypeScript directly with `--experimental-strip-types`
requires the `.ts` extension in the relative import.

This patch:

1. changes the test import to:
   `../src/lib/movement-ledger.ts`
2. enables TypeScript's `allowImportingTsExtensions` while `noEmit` is already true.

After copying, run:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npx tsc --noEmit
node --experimental-strip-types --test tests/movement-ledger.test.mts
npm run build
```

No backend/database file is changed.
