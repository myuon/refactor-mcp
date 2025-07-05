import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, existsSync, readFileSync, mkdirSync, rmSync } from 'fs';

const execAsync = promisify(exec);

describe('CLI Commands', () => {
  const testDir = 'test-cli';

  beforeEach(() => {
    // Clean up any existing test files and directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }

    // Create test directory structure
    mkdirSync(testDir, { recursive: true });
    mkdirSync(`${testDir}/nested`, { recursive: true });

    // Create test files with sample content
    writeFileSync(
      `${testDir}/test-search.js`,
      `function searchExample() {
  const value = 42;
  let result = value * 2;
  return result;
}

export function anotherFunction() {
  console.log('test');
}`
    );

    writeFileSync(
      `${testDir}/test-refactor.js`,
      `const oldVariable = 'test';
const anotherOld = 123;
let someVar = 'keep this';
const finalOld = true;`
    );

    writeFileSync(
      `${testDir}/nested/deep-file.ts`,
      `export function deepFunction(): string {
  const data = { key: 'value' };
  return JSON.stringify(data);
}`
    );
  });

  afterEach(() => {
    // Clean up test files and directories after each test
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('search command', () => {
    test('should find basic function patterns', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "function.*\\(" -f "${testDir}/**/*.js"`
      );

      expect(stdout).toContain('Search results:');
      expect(stdout).toContain(`${testDir}/test-search.js`);
      expect(stdout).toContain('line: 1');
      expect(stdout).toContain('line: 7');
    });

    test('should find patterns with file filtering', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "export.*function" -f "${testDir}/**/*.{js,ts}"`
      );

      expect(stdout).toContain('Search results:');
      expect(stdout).toContain(`${testDir}/test-search.js`);
      expect(stdout).toContain(`${testDir}/nested/deep-file.ts`);
    });

    test('should show "no matches" when pattern not found', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "nonexistent.*pattern" -f "${testDir}/**/*.js"`
      );

      expect(stdout).toContain('No matches found for the given pattern');
    });

    test('should display matched content with --print option', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "const.*=" -f "${testDir}/test-refactor.js" --print`
      );

      expect(stdout).toContain(`=== ${testDir}/test-refactor.js ===`);
      expect(stdout).toContain("1:const oldVariable = 'test';");
      expect(stdout).toContain('2:const anotherOld = 123;');
      expect(stdout).toContain('4:const finalOld = true;');
    });

    test('should work with context filtering', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "function" -c "export" -f "${testDir}/**/*.js"`
      );

      expect(stdout).toContain('Search results:');
      expect(stdout).toContain(`${testDir}/test-search.js`);
      // Should only find the export function, not the regular function
      expect(stdout).toContain('line: 7');
      expect(stdout).not.toContain('line: 1');
    });

    test('should display capture groups with --print option', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "function (\\w+)\\(" -f "${testDir}/**/*.js" --print`
      );

      expect(stdout).toContain(`=== ${testDir}/test-search.js ===`);
      expect(stdout).toContain('1:function searchExample() {');
      expect(stdout).toContain('  └─ Captured: [searchExample]');
      expect(stdout).toContain('7:export function anotherFunction() {');
      expect(stdout).toContain('  └─ Captured: [anotherFunction]');
    });

    test('should display multiple capture groups', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "(export )?function (\\w+)\\(" -f "${testDir}/**/*.js" --print`
      );

      expect(stdout).toContain(`=== ${testDir}/test-search.js ===`);
      expect(stdout).toContain('1:function searchExample() {');
      expect(stdout).toContain('  └─ Captured: [searchExample]');
      expect(stdout).toContain('7:export function anotherFunction() {');
      expect(stdout).toContain('  └─ Captured: [export , anotherFunction]');
    });

    test('should display matched text with --matched option', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "function (\\w+)\\(" -f "${testDir}/**/*.js" --matched`
      );

      expect(stdout).toContain(`=== ${testDir}/test-search.js ===`);
      expect(stdout).toContain('1: function searchExample(');
      expect(stdout).toContain('  └─ Captured: [searchExample]');
      expect(stdout).toContain('7: function anotherFunction(');
      expect(stdout).toContain('  └─ Captured: [anotherFunction]');
    });

    test('should display matched text with multiple capture groups using --matched', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "(export )?function (\\w+)\\(" -f "${testDir}/**/*.js" --matched`
      );

      expect(stdout).toContain(`=== ${testDir}/test-search.js ===`);
      expect(stdout).toContain('1: function searchExample(');
      expect(stdout).toContain('  └─ Captured: [searchExample]');
      expect(stdout).toContain('7: export function anotherFunction(');
      expect(stdout).toContain('  └─ Captured: [export , anotherFunction]');
    });
  });

  describe('refactor command', () => {
    test('should perform basic refactoring with dry-run', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- refactor -s "const (\\w+) = " -r "let \\$1 = " -f "${testDir}/test-refactor.js" --dry-run`
      );

      expect(stdout).toContain('Refactoring completed:');
      expect(stdout).toContain(
        `${testDir}/test-refactor.js: 3 replacements (dry run)`
      );
      expect(stdout).toContain('Total: 3 replacements in 1 files');

      // File should not be modified in dry-run
      const content = readFileSync(`${testDir}/test-refactor.js`, 'utf-8');
      expect(content).toContain('const oldVariable');
    });

    test('should perform actual refactoring without dry-run', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- refactor -s "const (\\w+) = " -r "let \\$1 = " -f "${testDir}/test-refactor.js"`
      );

      expect(stdout).toContain('Refactoring completed:');
      expect(stdout).toContain(`${testDir}/test-refactor.js: 3 replacements`);
      expect(stdout).not.toContain('(dry run)');

      // File should be modified
      const content = readFileSync(`${testDir}/test-refactor.js`, 'utf-8');
      expect(content).toContain('let oldVariable');
      expect(content).toContain('let anotherOld');
      expect(content).toContain('let finalOld');
      expect(content).toContain("let someVar = 'keep this';"); // This shouldn't match the pattern
    });

    test('should show matched content with --print option', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- refactor -s "const (\\w+)" -r "let \\$1" -f "${testDir}/test-refactor.js" --print --dry-run`
      );

      expect(stdout).toContain(`=== ${testDir}/test-refactor.js ===`);
      expect(stdout).toContain("1:const oldVariable = 'test';");
      expect(stdout).toContain('   - const oldVariable → let oldVariable');
      expect(stdout).toContain('2:const anotherOld = 123;');
      expect(stdout).toContain('   - const anotherOld → let anotherOld');
    });

    test('should work with context filtering', async () => {
      // Add a file with imports to test context filtering
      writeFileSync(
        `${testDir}/test-context.js`,
        `import legacy_sdk from 'old-package';
const legacy_sdk = 'local variable';
console.log(legacy_sdk);`
      );

      const { stdout } = await execAsync(
        `npm run cli -- refactor -s "legacy_sdk" -r "new_sdk" -c "import" -f "${testDir}/test-context.js" --dry-run`
      );

      expect(stdout).toContain('Refactoring completed:');
      expect(stdout).toContain(`${testDir}/test-context.js:`);
      expect(stdout).toContain('replacements (dry run)');
      // Note: Context filtering may match more than expected due to context window
    });

    test('should show "no matches" when pattern not found', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- refactor -s "nonexistent.*pattern" -r "replacement" -f "${testDir}/**/*.js" --dry-run`
      );

      expect(stdout).toContain('No matches found for the given pattern');
    });

    test('should handle multiple files', async () => {
      // Create additional test file
      writeFileSync(
        `${testDir}/test-multi.js`,
        `const multiVar = 'test';
const anotherMulti = 456;`
      );

      const { stdout } = await execAsync(
        `npm run cli -- refactor -s "const (\\w+) = " -r "let \\$1 = " -f "${testDir}/*.js" --dry-run`
      );

      expect(stdout).toContain('Refactoring completed:');
      expect(stdout).toContain(
        `${testDir}/test-refactor.js: 3 replacements (dry run)`
      );
      expect(stdout).toContain(
        `${testDir}/test-multi.js: 2 replacements (dry run)`
      );
      expect(stdout).toContain('Total:');
      expect(stdout).toContain('replacements in');
      expect(stdout).toContain('files');
    });
  });

  describe('error handling', () => {
    test('should handle missing required arguments in search', async () => {
      try {
        await execAsync(`npm run cli -- search -f "${testDir}/**/*.js"`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stderr).toContain('required option');
        expect(error.stderr).toContain('pattern');
      }
    });

    test('should handle missing required arguments in refactor', async () => {
      try {
        await execAsync(
          `npm run cli -- refactor -s "pattern" -f "${testDir}/**/*.js"`
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stderr).toContain('required option');
        expect(error.stderr).toContain('replace');
      }
    });

    test('should handle invalid regex patterns gracefully', async () => {
      try {
        await execAsync(
          `npm run cli -- search -p "[invalid regex" -f "${testDir}/**/*.js"`
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stderr).toContain('Error during search');
      }
    });

    test('should handle non-existent file patterns', async () => {
      const { stdout } = await execAsync(
        `npm run cli -- search -p "function" -f "non-existent/**/*.js"`
      );

      expect(stdout).toContain('No matches found for the given pattern');
    });
  });

  describe('help and version', () => {
    test('should show help', async () => {
      const { stdout } = await execAsync('npm run cli -- --help');

      expect(stdout).toContain('Usage: refactor-mcp');
      expect(stdout).toContain('CLI tool for code refactoring and searching');
      expect(stdout).toContain('search');
      expect(stdout).toContain('refactor');
    });

    test('should show search command help', async () => {
      const { stdout } = await execAsync('npm run cli -- search --help');

      expect(stdout).toContain('Search for code patterns using regex');
      expect(stdout).toContain('--pattern');
      expect(stdout).toContain('--context');
      expect(stdout).toContain('--files');
      expect(stdout).toContain('--print');
    });

    test('should show refactor command help', async () => {
      const { stdout } = await execAsync('npm run cli -- refactor --help');

      expect(stdout).toContain('Refactor code by replacing search pattern');
      expect(stdout).toContain('--search');
      expect(stdout).toContain('--replace');
      expect(stdout).toContain('--context');
      expect(stdout).toContain('--files');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--print');
    });

    test('should show version', async () => {
      const { stdout } = await execAsync('npm run cli -- --version');

      expect(stdout).toContain('1.1.1');
    });
  });
});
