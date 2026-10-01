// Run: node resources/js/lib/qr.check.mjs
import assert from 'node:assert/strict';

const { assetIdFromQr } = await import('./qr.ts');

assert.equal(assetIdFromQr('https://sibima.test/scan/12'), 12);
assert.equal(assetIdFromQr('https://sibima.test/scan/12/'), 12);
assert.equal(assetIdFromQr('http://localhost:8000/assets/345'), 345);
assert.equal(assetIdFromQr('  https://x.id/assets/7  '), 7);
assert.equal(assetIdFromQr('https://sibima.test/assets/labels'), null);
assert.equal(assetIdFromQr('https://sibima.test/assets/5/edit'), null);
assert.equal(assetIdFromQr('https://sibima.test/scan/abc'), null);
assert.equal(assetIdFromQr('https://example.com/other'), null);
assert.equal(assetIdFromQr('REG-0001'), null);
assert.equal(assetIdFromQr(''), null);

console.log('qr.ts OK');

assert.equal(assetIdFromQr('https://sibima.test/assets/99999999999999999999'), null);
assert.equal(assetIdFromQr('https://sibima.test/scan/123456789012345'), 123456789012345);
console.log('qr.ts oversize OK');
