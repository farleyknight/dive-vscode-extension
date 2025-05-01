import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd', // Using 'suite' and 'test' corresponds to tdd ui
		color: true
	});

	// Use path.resolve to get the absolute path to the test suite directory
	const testsRoot = path.resolve(__dirname);

	return new Promise((c, e) => {
		try {
			// Match all files ending in .test.js in the testsRoot directory
			const files = globSync('**/*.test.js', { cwd: testsRoot });

			// Add files to the test suite
			files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

			// Run the mocha test
			mocha.run((failures: number) => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			console.error('Error setting up or running Mocha tests:', err);
			e(err);
		}
	});
}