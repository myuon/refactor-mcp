import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import {
  performRefactor,
  formatRefactorResults,
} from '../../src/core/refactor-tool.js';

describe('Refactor Tool', () => {
  const testDir = 'tests/temp-refactor';

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Create test files
    writeFileSync(
      `${testDir}/variables.js`,
      `const oldVariable = 'test';
const anotherOld = 123;
let someVar = 'keep this';
const finalOld = true;`
    );

    writeFileSync(
      `${testDir}/functions.ts`,
      `function oldFunction() {
  return 'old';
}

export function exportedOldFunction() {
  return oldFunction();
}

const arrowOldFunction = () => 'arrow';`
    );

    writeFileSync(
      `${testDir}/context-test.js`,
      `import legacy_sdk from 'old-package';
const legacy_sdk_local = 'local variable';
console.log(legacy_sdk_local);
legacy_sdk.initialize();`
    );
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('performRefactor', () => {
    test('should perform basic refactoring', async () => {
      const results = await performRefactor({
        searchPattern: 'const (\\w+) = ',
        replacePattern: 'let $1 = ',
        filePattern: `${testDir}/variables.js`,
        dryRun: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe(`${testDir}/variables.js`);
      expect(results[0].replacements).toBe(3);
      expect(results[0].modified).toBe(true);

      // Check that file was actually modified
      const content = readFileSync(`${testDir}/variables.js`, 'utf-8');
      expect(content).toContain('let oldVariable = ');
      expect(content).toContain('let anotherOld = ');
      expect(content).toContain('let finalOld = ');
      expect(content).toContain('let someVar = '); // This should match too
    });

    test('should perform dry-run without modifying files', async () => {
      const originalContent = readFileSync(`${testDir}/variables.js`, 'utf-8');

      const results = await performRefactor({
        searchPattern: 'const (\\w+) = ',
        replacePattern: 'let $1 = ',
        filePattern: `${testDir}/variables.js`,
        dryRun: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].replacements).toBe(3);
      expect(results[0].modified).toBe(true);

      // Check that file was NOT modified
      const content = readFileSync(`${testDir}/variables.js`, 'utf-8');
      expect(content).toBe(originalContent);
    });

    test('should work with capture groups', async () => {
      const results = await performRefactor({
        searchPattern: 'function (\\w+)\\(',
        replacePattern: 'function new$1(',
        filePattern: `${testDir}/functions.ts`,
        dryRun: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0].replacements).toBe(2);

      const content = readFileSync(`${testDir}/functions.ts`, 'utf-8');
      expect(content).toContain('function newoldFunction(');
      expect(content).toContain('function newexportedOldFunction(');
    });

    test('should work with context filtering', async () => {
      const results = await performRefactor({
        searchPattern: 'legacy_sdk',
        replacePattern: 'new_sdk',
        contextPattern: 'import',
        filePattern: `${testDir}/context-test.js`,
        dryRun: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0].replacements).toBeGreaterThan(0);

      const content = readFileSync(`${testDir}/context-test.js`, 'utf-8');
      expect(content).toContain('import new_sdk from');
      expect(content).toContain('legacy_sdk_local'); // Local variable should not change
      // Context filtering may match more lines due to the 5-line context window
    });

    test('should handle multiple files', async () => {
      const results = await performRefactor({
        searchPattern: 'old',
        replacePattern: 'new',
        filePattern: `${testDir}/**/*.{js,ts}`,
        dryRun: false,
      });

      expect(results.length).toBeGreaterThan(1);
      const totalReplacements = results.reduce(
        (sum, result) => sum + result.replacements,
        0
      );
      expect(totalReplacements).toBeGreaterThan(0);
    });

    test('should return empty results when no matches found', async () => {
      const results = await performRefactor({
        searchPattern: 'nonexistent.*pattern',
        replacePattern: 'replacement',
        filePattern: `${testDir}/**/*.js`,
        dryRun: false,
      });

      expect(results).toHaveLength(0);
    });

    test('should collect match information correctly', async () => {
      const results = await performRefactor({
        searchPattern: 'const (\\w+)',
        replacePattern: 'let $1',
        filePattern: `${testDir}/variables.js`,
        dryRun: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].matches).toHaveLength(3);

      const match = results[0].matches[0];
      expect(match).toHaveProperty('line');
      expect(match).toHaveProperty('content');
      expect(match).toHaveProperty('original');
      expect(match).toHaveProperty('replaced');
      expect(match.original).toContain('const');
      expect(match.replaced).toContain('let');
    });
  });

  describe('formatRefactorResults', () => {
    test('should format single result correctly', async () => {
      const results = await performRefactor({
        searchPattern: 'const',
        replacePattern: 'let',
        filePattern: `${testDir}/variables.js`,
        dryRun: true,
      });

      const formatted = formatRefactorResults(results);
      expect(formatted).toContain('Refactoring completed:');
      expect(formatted).toContain(`${testDir}/variables.js:`);
      expect(formatted).toContain('replacements');
      expect(formatted).toContain('Total:');
    });

    test('should format dry-run results correctly', async () => {
      const results = await performRefactor({
        searchPattern: 'const',
        replacePattern: 'let',
        filePattern: `${testDir}/variables.js`,
        dryRun: true,
      });

      const formatted = formatRefactorResults(results, true);
      expect(formatted).toContain('(dry run)');
    });

    test('should format empty results correctly', () => {
      const formatted = formatRefactorResults([]);
      expect(formatted).toBe('No matches found for the given pattern');
    });

    test('should format multiple results correctly', async () => {
      const results = await performRefactor({
        searchPattern: 'old',
        replacePattern: 'new',
        filePattern: `${testDir}/**/*.{js,ts}`,
        dryRun: true,
      });

      const formatted = formatRefactorResults(results);
      expect(formatted).toContain('Refactoring completed:');
      expect(formatted.split('\n').length).toBeGreaterThan(3);
      expect(formatted).toContain('Total:');
    });

    test('should calculate total replacements correctly', async () => {
      const results = await performRefactor({
        searchPattern: 'old',
        replacePattern: 'new',
        filePattern: `${testDir}/**/*.{js,ts}`,
        dryRun: true,
      });

      const formatted = formatRefactorResults(results);
      const totalReplacements = results.reduce(
        (sum, result) => sum + result.replacements,
        0
      );
      expect(formatted).toContain(`Total: ${totalReplacements} replacements`);
    });
  });

  describe('edge cases', () => {
    test('should handle files with no content', async () => {
      writeFileSync(`${testDir}/empty.js`, '');

      const results = await performRefactor({
        searchPattern: 'anything',
        replacePattern: 'replacement',
        filePattern: `${testDir}/empty.js`,
        dryRun: false,
      });

      expect(results).toHaveLength(0);
    });

    test('should handle invalid regex gracefully', async () => {
      await expect(
        performRefactor({
          searchPattern: '[invalid regex',
          replacePattern: 'replacement',
          filePattern: `${testDir}/**/*.js`,
          dryRun: false,
        })
      ).rejects.toThrow();
    });

    test('should handle non-existent file patterns', async () => {
      const results = await performRefactor({
        searchPattern: 'function',
        replacePattern: 'method',
        filePattern: 'non-existent/**/*.js',
        dryRun: false,
      });

      expect(results).toHaveLength(0);
    });

    test('should handle complex replacement patterns', async () => {
      writeFileSync(
        `${testDir}/complex.js`,
        `function getName() { return 'name'; }
function getAge() { return 25; }`
      );

      const results = await performRefactor({
        searchPattern: 'function get(\\w+)\\(\\)',
        replacePattern: 'const get$1 = ()',
        filePattern: `${testDir}/complex.js`,
        dryRun: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0].replacements).toBe(2);

      const content = readFileSync(`${testDir}/complex.js`, 'utf-8');
      expect(content).toContain('const getName = ()');
      expect(content).toContain('const getAge = ()');
    });

    test('should preserve file content when no matches', async () => {
      const originalContent = readFileSync(`${testDir}/variables.js`, 'utf-8');

      const results = await performRefactor({
        searchPattern: 'nonexistent',
        replacePattern: 'replacement',
        filePattern: `${testDir}/variables.js`,
        dryRun: false,
      });

      expect(results).toHaveLength(0);

      const content = readFileSync(`${testDir}/variables.js`, 'utf-8');
      expect(content).toBe(originalContent);
    });
  });
});
