const fs = require('fs');
const file = 'backend/src/main.ts';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(/import { AppModule } from '\.\/app\.module(?:\.js)?';/, "import { AppModule } from './app.module.js';\nimport { AllExceptionsFilter } from './all-exceptions.filter.js';");
c = c.replace(/app\.useGlobalPipes\(/, 'app.useGlobalFilters(new AllExceptionsFilter());\n  app.useGlobalPipes(');
fs.writeFileSync(file, c);
console.log('Modified main.ts');
