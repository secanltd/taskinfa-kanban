// Quick script to hash API key for database insertion
const crypto = require('crypto');

const apiKey = 'tk_6fcc606ac191247d72dce700110cf77a';

// Hash the key using SHA-256
const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

console.log('API Key:', apiKey);
console.log('Hash:', hash);
console.log('\nSQL Command:');
console.log(`INSERT INTO api_keys (id, workspace_id, key_hash, name) VALUES ('api_key_1', 'default', '${hash}', 'Development Key');`);
