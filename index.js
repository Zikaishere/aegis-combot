const { execSync } = require('child_process');
const fs = require('fs');

if (process.env.AUTO_UPDATE === '1') {
  try {
    console.log('Pulling latest from GitHub...');
    
    if (!fs.existsSync('.git')) {
      console.log('Initializing git repository...');
      execSync('git init && git remote add origin https://github.com/zikaishere/blaze-ai', { stdio: 'inherit' });
    }
    
    execSync('git fetch origin main && git reset --hard origin/main', { stdio: 'inherit' });
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
  } catch (error) {
    console.error('Auto-update failed:', error.message);
  }
}

require("dotenv").config();

execSync('npx tsx src/index.ts', { stdio: 'inherit', env: { ...process.env } });
