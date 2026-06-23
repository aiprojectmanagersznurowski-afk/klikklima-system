const { execSync } = require('child_process');
try {
  execSync('npx playwright test tests/triageFlow.spec.ts --project=chromium', { stdio: 'inherit' });
} catch (e) {
  console.log("Playwright test failed!");
}
