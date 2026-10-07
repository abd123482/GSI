const fs = require('fs');
const path = require('path');

const directory = 'src';

const replacements = {
  '#2b2622': '#18181b',
  '#383330': '#27272a',
  '#2f2a26': '#27272a',
  '#3f3a36': '#3f3f46',
  '#4d4742': '#52525b',
  '#45403c': '#52525b',
  '#f7f5f0': '#fafafa',
  '#dad2c1': '#f4f4f5',
  '#c9c0ad': '#d4d4d8',
  '#aea69c': '#a1a1aa',
  '#8c827a': '#71717a'
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let changedFiles = 0;

walkDir(directory, function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (const [oldHex, newHex] of Object.entries(replacements)) {
      // Create a global regex for the old hex, case insensitive
      const regex = new RegExp(oldHex, 'gi');
      content = content.replace(regex, newHex);
    }
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      changedFiles++;
    }
  }
});

console.log(`Replaced theme colors in ${changedFiles} files.`);
