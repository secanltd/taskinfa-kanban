const { execSync } = require('child_process');
const { version: pkgVersion } = require('../package.json');

// CI sets ORCHESTRATOR_VERSION from the git tag (e.g. "1.0.7").
// Local builds fall back to package.json version.
const version = process.env.ORCHESTRATOR_VERSION || pkgVersion;

// The banner comment survives esbuild --minify and is greppable
// by get_installed_version() in install.sh.
const banner = `/* orchestrator-version:${version} */`;

execSync(
  `npx esbuild scripts/orchestrator.ts --bundle --platform=node --target=node18 --outfile=dist/orchestrator.js --minify --define:__ORCHESTRATOR_VERSION__='"${version}"' --banner:js='${banner}'`,
  { stdio: 'inherit' }
);

console.log(`Built orchestrator v${version} → dist/orchestrator.js`);
