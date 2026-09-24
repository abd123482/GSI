const fs = require('fs');

// 1. page.tsx
let p = fs.readFileSync('src/app/inventory/tasks/[taskId]/page.tsx', 'utf-8');
p = p.replace(/task\?\.isSerialized/g, 'task?.scope?.isSerialized');
p = p.replace(/task\.isSerialized/g, 'task?.scope?.isSerialized');
fs.writeFileSync('src/app/inventory/tasks/[taskId]/page.tsx', p);

// 2. use-dashboard.ts
let d = fs.readFileSync('src/hooks/use-dashboard.ts', 'utf-8');
d = d.replace(/enabled: authReady,\s*enabled: authReady && Boolean\(userId\),/g, 'enabled: authReady && Boolean(userId),');
fs.writeFileSync('src/hooks/use-dashboard.ts', d);

// 3. use-movements.ts
let m = fs.readFileSync('src/hooks/use-movements.ts', 'utf-8');
if (!m.includes('useAuthQueryContext')) {
  m = m.replace(/import\s*\{\s*useApi,?\s*\}\s*from\s*'[^']+';/, "import { useApi } from './use-api';\nimport { useAuthQueryContext } from './use-auth-query-context';");
  fs.writeFileSync('src/hooks/use-movements.ts', m);
}

// 4. use-serial-numbers.ts
let s = fs.readFileSync('src/hooks/use-serial-numbers.ts', 'utf-8');
if (!s.includes('useAuthQueryContext')) {
  s = s.replace(/import\s*\{\s*useApi,?\s*\}\s*from\s*'[^']+';/, "import { useApi } from './use-api';\nimport { useAuthQueryContext } from './use-auth-query-context';");
  fs.writeFileSync('src/hooks/use-serial-numbers.ts', s);
}

// 5. use-permissions.ts
let perm = fs.readFileSync('src/hooks/use-permissions.ts', 'utf-8');
perm = perm.replace(/const \{ userId \} = useAuth\(\);\s*/, '');
perm = perm.replace(/const \{ userId, authReady \} = useAuthQueryContext\(\);/, 'const { userId, authReady } = useAuthQueryContext();'); // just in case
fs.writeFileSync('src/hooks/use-permissions.ts', perm);

console.log('Fixed all TS errors again');
