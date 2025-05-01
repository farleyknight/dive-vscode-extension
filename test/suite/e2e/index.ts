import * as path from 'path';
import Mocha from 'mocha';

// This is the entry point *specifically* for E2E tests run via runTest.ts

export function run(): Promise<void> {
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 20000 // Use E2E timeout
	});

	// Resolve the path to the compiled e2e.test.js file relative to this index.js file
	const e2eTestFile = path.resolve(__dirname, 'e2e.test.js');

	return new Promise((c, e) => {
		try {
			console.log(`[E2E Runner] Adding test file: ${e2eTestFile}`);
			mocha.addFile(e2eTestFile);

			mocha.run(failures => {
				if (failures > 0) {
					e(new Error(`${failures} E2E tests failed.`));
				} else {
					console.log('[E2E Runner] All E2E tests passed.');
					c();
				}
			});
		} catch (err) {
			console.error('[E2E Runner] Error running tests:', err);
			e(err);
		}
	});
}