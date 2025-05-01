import * as path from 'path';
import * as cp from 'child_process';
import {
	runTests,
	downloadAndUnzipVSCode,
	resolveCliArgsFromVSCodeExecutablePath
} from '@vscode/test-electron';

async function main() {
	console.log('[runTest.ts] STARTING E2E Test Run');
	try {
		// Specify the VS Code version to use
		const vscodeVersion = 'stable';

		// Download VS Code executable
		const vscodeExecutablePath = await downloadAndUnzipVSCode(vscodeVersion);

		// Get the CLI path and arguments
		const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

		// Install the redhat.java extension
		console.log('[runTest.ts] Installing redhat.java extension...');
		cp.spawnSync(
			cliPath,
			[...args, '--install-extension', 'redhat.java', '--force'],
			{
				encoding: 'utf-8',
				stdio: 'inherit'
			}
		);
		console.log('[runTest.ts] Installation command finished.');

		// The folder containing the Extension Manifest package.json
		// Passed to --extensionDevelopmentPath
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the *compiled* extension test script entry point.
		// Passed to --extensionTestsPath. This should point to the file that finds ALL tests (unit + e2e).
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// The path to the workspace to open for the test instance.
		// Passed to --folder-uri or as launchArgs.
		// Using the actual fixture path.
		const testWorkspace = path.resolve(extensionDevelopmentPath, 'test/fixtures/java-spring-test-project');
		console.log(`[runTest.ts] Using workspace: ${testWorkspace}`);

		// Download VS Code, unzip it and run the integration test.
		// Ensure that the compiled JS files are used.
		await runTests({
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [testWorkspace, '--disable-extensions=false']
		});
		console.log('[runTest.ts] runTests completed.');
	} catch (err) {
		console.error('[runTest.ts] Failed to run tests:', err);
		process.exit(1);
	}
}

main();