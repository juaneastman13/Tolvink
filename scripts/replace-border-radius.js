// Script to replace hardcoded borderRadius values with R tokens from theme.jsx
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const mapping = { 4:'R.xs', 6:'R.sm', 8:'R.md', 10:'R.md', 12:'R.lg', 14:'R.lg', 16:'R.xl', 20:'R.pill', 24:'R.pill' };

function findJsx(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...findJsx(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.jsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findJsx(srcDir).filter(f => !f.includes('LandingScreen.jsx'));
let totalFiles = 0;
let totalRepl = 0;

for (const fp of files) {
  let content = fs.readFileSync(fp, 'utf8');
  let count = 0;

  content = content.replace(/borderRadius\s*:\s*(\d+)/g, (match, numStr) => {
    const num = parseInt(numStr, 10);
    const token = mapping[num];
    if (token) {
      count++;
      return 'borderRadius: ' + token;
    }
    return match;
  });

  if (count > 0) {
    // Check if R is already imported from theme
    const hasR = /import\s*\{[^}]*\bR\b[^}]*\}\s*from\s*['"][^'"]*theme['"]/.test(content);

    if (!hasR) {
      // Try to add R to existing theme import
      const themeImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*(['"][^'"]*theme['"])/);
      if (themeImportMatch) {
        const oldImport = themeImportMatch[0];
        const imports = themeImportMatch[1];
        const src = themeImportMatch[2];
        const newImport = 'import {' + imports.trimEnd() + ', R} from ' + src;
        content = content.replace(oldImport, newImport);
      } else {
        // Determine relative path to theme
        const relDir = path.relative(path.dirname(fp), srcDir).replace(/\\/g, '/');
        const themePath = (relDir || '.') + '/theme';
        const importLine = `import { R } from "${themePath}";`;

        // Insert after last import
        const lines = content.split('\n');
        let lastImportIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
        }
        if (lastImportIdx >= 0) {
          lines.splice(lastImportIdx + 1, 0, importLine);
        } else {
          lines.unshift(importLine);
        }
        content = lines.join('\n');
      }
    }

    fs.writeFileSync(fp, content, 'utf8');
    totalFiles++;
    totalRepl += count;
    const relPath = path.relative(srcDir, fp).replace(/\\/g, '/');
    console.log(`  ${relPath}: ${count} replacements`);
  }
}

console.log(`\nDone: ${totalFiles} files modified, ${totalRepl} total replacements`);
