const { execSync } = require('child_process');
const { version } = require('../package.json');

execSync(
  `npx esbuild scripts/orchestrator.ts --bundle --platform=node --target=node18 --outfile=dist/orchestrator.js --minify --define:__ORCHESTRATOR_VERSION__='"${version}"'`,
  { stdio: 'inherit' }
);

console.log(`Built orchestrator v${version} → dist/orchestrator.js`);
