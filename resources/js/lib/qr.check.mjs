// Run: node resources/js/lib/qr.check.mjs
import assert from 'node:assert/strict';

const { qrTokenFromScan } = await import('./qr.ts');

assert.equal(qrTokenFromScan('https://sibima.test/scan/OrRzzbS8OJcRMODS'), 'OrRzzbS8OJcRMODS');
assert.equal(qrTokenFromScan('https://sibima.test/scan/OrRzzbS8OJcRMODS/'), 'OrRzzbS8OJcRMODS');
assert.equal(qrTokenFromScan('http://localhost:8000/scan/1234567890abcdef'), '1234567890abcdef');
assert.equal(qrTokenFromScan('  https://x.id/scan/AbCdEfGhIjKlMnOp  '), 'AbCdEfGhIjKlMnOp');
assert.equal(qrTokenFromScan('OrRzzbS8OJcRMODS'), 'OrRzzbS8OJcRMODS');
assert.equal(qrTokenFromScan('  OrRzzbS8OJcRMODS  '), 'OrRzzbS8OJcRMODS');

// Legacy and invalid cases should return null
assert.equal(qrTokenFromScan('https://sibima.test/scan/12'), null);
assert.equal(qrTokenFromScan('http://localhost:8000/assets/345'), null);
assert.equal(qrTokenFromScan('https://sibima.test/scan/OrRzzbS8OJcRMOD'), null);
assert.equal(qrTokenFromScan('https://sibima.test/scan/OrRzzbS8OJcRMODSZ'), null);
assert.equal(qrTokenFromScan('https://sibima.test/scan/OrRzzbS8OJcRMO-S'), null);
assert.equal(qrTokenFromScan('https://sibima.test/assets/labels'), null);
assert.equal(qrTokenFromScan('https://example.com/other'), null);
assert.equal(qrTokenFromScan('REG-0001'), null);
assert.equal(qrTokenFromScan(''), null);

console.log('qr.ts qrTokenFromScan OK');
