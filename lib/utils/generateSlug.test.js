// lib/utils/generateSlug.test.js
import dotenv from 'dotenv';
dotenv.config();

import { slugify } from './generateSlug.js';

// Test cases
console.log('Testing slugify function:\n');

const testCases = [
  { input: 'John Doe', expected: 'john-doe' },
  { input: 'user', expected: 'user' }, // Updated: we extract email parts first
  { input: 'Digital Art Co.', expected: 'digital-art-co' },
  { input: 'José María', expected: 'jose-maria' },
  { input: 'user___name', expected: 'user-name' },
  { input: '!!!invalid!!!', expected: 'invalid' },
  { input: 'UPPERCASE', expected: 'uppercase' },
  { input: '  spaces  ', expected: 'spaces' },
  { input: 'test--multiple--dashes', expected: 'test-multiple-dashes' }
];

testCases.forEach(({ input, expected }) => {
  const result = slugify(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} "${input}" → "${result}" (expected: "${expected}")`);
});

console.log('\n✅ Slugify tests complete!');
console.log('\nℹ️  Note: Email addresses should use generateSlugFromEmail() which extracts the local part first.');
