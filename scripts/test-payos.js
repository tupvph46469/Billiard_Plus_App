// scripts/test-payos.js
// Simple Node script to test payosService.createQrPayment locally and see full error attempts
const path = require('path');
const svc = require(path.join(__dirname, '..', 'src', 'services', 'payosService.js'));

(async () => {
  try {
    const amount = process.argv[2] ? Number(process.argv[2]) : 1000;
    console.log('Testing createQrPayment amount=', amount);
    const res = await svc.createQrPayment({ amount, description: 'test from local', externalId: 'TEST_LOCAL' });
    console.log('OK', res);
  } catch (err) {
    console.error('ERR', err && err.message);
    if (err && err.attempts) {
      console.error('Attempts:');
      err.attempts.forEach(a => console.error(JSON.stringify(a, null, 2)));
    }
    process.exit(2);
  }
})();