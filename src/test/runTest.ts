import * as path from 'path';
import * as cp from 'child_process';
import {
	runTests,
	downloadAndUnzipVSCode,
	resolveCliArgsFromVSCodeExecutablePath
} from '@vscode/test-electron';

async function main() {
	console.log('--- STARTING runTest.ts ---');
	try {
		// Specify the VS Code version to use
		const vscodeVersion = 'stable';

		// Download VS Code executable
		const vscodeExecutablePath = await downloadAndUnzipVSCode(vscodeVersion);

		// Get the CLI path and arguments
		const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

		// Install the redhat.java extension
		console.log('Installing redhat.java extension...');
		cp.spawnSync(
			cliPath,
			[...args, '--install-extension', 'redhat.java', '--force'],
			{
				encoding: 'utf-8',
				stdio: 'inherit'
			}
		);
		console.log('Installation command finished.');

		// The folder containing the Extension Manifest package.json
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the *E2E* extension test script entry point
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		// The path to the workspace to open for the test instance
		// Passed to --folder-uri
		const testWorkspace = path.resolve(extensionDevelopmentPath, 'test-fixtures/e2e-java-project');

		// Specify any additional extensions to install - REMOVED
		// const extensionsToInstall = ['redhat.java']; // Example: Install Java Extension Pack - REMOVED

		// Download VS Code, unzip it and run the integration test
		await runTests({
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [testWorkspace], // REMOVED --disable-extensions
			// extensionTestsEnv // Pass environment variable to test runner process - REMOVED
			// extensionsToInstall // REMOVED
		});
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

main();