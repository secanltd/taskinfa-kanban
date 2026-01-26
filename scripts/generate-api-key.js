#!/usr/bin/env node

// Script to generate API keys for Taskinfa-Bot
// Usage: node scripts/generate-api-key.js [workspace_id] [key_name]

import { randomBytes } from 'crypto';
import { generateApiKey } from '../packages/dashboard/dist/lib/auth/jwt.js';

const workspaceId = process.argv[2] || 'default';
const keyName = process.argv[3] || 'Generated Key';

console.log('Generating API key...\n');
console.log(`Workspace: ${workspaceId}`);
console.log(`Key Name: ${keyName}\n`);

try {
  const result = await generateApiKey(workspaceId, keyName, 365);

  console.log('✓ API Key Generated Successfully!\n');
  console.log('─'.repeat(60));
  console.log('API KEY (save this securely):');
  console.log(`\x1b[32m${result.key}\x1b[0m\n`);
  console.log('Key ID:');
  console.log(`${result.id}\n`);
  console.log('─'.repeat(60));
  console.log('\nAdd this to your .env file:');
  console.log(`TASKINFA_API_KEY=${result.key}\n`);
  console.log('Or use it in API requests:');
  console.log(`Authorization: Bearer ${result.key}\n`);
} catch (error) {
  console.error('Error generating API key:', error);
  process.exit(1);
}
