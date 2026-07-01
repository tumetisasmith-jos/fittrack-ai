const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/['"]âœ“ Valid email['"]/g, "'✓ Valid email'");
  content = content.replace(/['"]âœ“ Valid email address['"]/g, "'✓ Valid email address'");
  content = content.replace(/['"]o" Valid email['"]/g, "'✓ Valid email'");
  content = content.replace(/['"] Valid email address['"]/g, "'✓ Valid email address'");
  content = content.replace(/['"] Email looks good['"]/g, "'✓ Email looks good'");
  
  // Also match any weird combination just in case
  content = content.replace(/ok \? '.*?' \: 'Please enter a valid email address'/g, "ok ? '✓ Valid email' : 'Please enter a valid email address'");
  fs.writeFileSync(filePath, content, 'utf-8');
}

fixFile('frontend/login.html');
fixFile('frontend/signup.html');
fixFile('frontend/forgot-password.html');

console.log('Fixed encoding issues in frontend HTML files.');
