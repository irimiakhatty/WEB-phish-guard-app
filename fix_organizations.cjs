
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'apps/web/src/app/actions/organizations.ts');

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace all occurrences of status: "active", (handling whitespace)
  // Regex: \s*status:\s*"active",?
  const newContent = content.replace(/\s*status:\s*"active",?/g, '');
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('File updated successfully.');
} catch (err) {
  console.error('Error updating file:', err);
}
