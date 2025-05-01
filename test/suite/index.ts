import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd', // Using 'suite' and 'test' corresponds to tdd ui
		color: true,
		timeout: 10000 // Increased timeout slightly for potentially slower tests
	});

	// Use path.resolve to get the absolute path to the test suite directory
	const testsRoot = path.resolve(__dirname); // Test files are relative to this directory (e.g., ./, ./e2e/)

	return new Promise((c, e) => {
		try {
			// Match all files ending in .test.js recursively within testsRoot
			// This will find ./<name>.test.js and ./e2e/<name>.test.js etc.
			const files = globSync('**/*.test.js', { cwd: testsRoot });

			// Add files to the test suite
			files.forEach(f => {
				const filePath = path.resolve(testsRoot, f);
				console.log(`[suite/index.ts] Adding test file: ${filePath}`); // Log added files
				mocha.addFile(filePath);
			});

			if (files.length === 0) {
				console.warn('[suite/index.ts] No test files found matching **/*.test.js');
			}

			// Run the mocha test
			mocha.run((failures: number) => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			console.error('[suite/index.ts] Error setting up or running Mocha tests:', err);
			e(err);
		}
	});
}