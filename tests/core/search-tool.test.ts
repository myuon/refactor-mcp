import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import {
  performSearch,
  formatSearchResults,
} from '../../src/core/search-tool.js';

describe('Search Tool', () => {
  const testDir = 'tests/temp-search';

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Create test files
    writeFileSync(
      `${testDir}/test1.js`,
      `function testFunction() {
  const variable = 'test';
  return variable;
}

export function exportedFunction() {
  console.log('exported');
  return 'result';
}`
    );

    writeFileSync(
      `${testDir}/test2.ts`,
      `interface TestInterface {
  id: number;
  name: string;
}

export class TestClass {
  getData(): TestInterface {
    return { id: 1, name: 'test' };
  }
}`
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

  describe('performSearch', () => {
    test('should find basic function patterns', async () => {
      const results = await performSearch({
        searchPattern: 'function.*\\(',
        filePattern: `${testDir}/**/*.js`,
      });

      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe(`${testDir}/test1.js`);
      expect(results[0].matches).toHaveLength(2);
      expect(results[0].lineNumbers).toEqual([1, 6]);
      expect(results[0].groupedLines).toEqual(['line: 1', 'line: 6']);
    });

    test('should find patterns with file filtering', async () => {
      const results = await performSearch({
        searchPattern: 'export.*',
        filePattern: `${testDir}/**/*.{js,ts}`,
      });

      expect(results).toHaveLength(2);
      expect(results.some(r => r.filePath.endsWith('test1.js'))).toBe(true);
      expect(results.some(r => r.filePath.endsWith('test2.ts'))).toBe(true);
    });

    test('should work with context filtering', async () => {
      const results = await performSearch({
        searchPattern: 'legacy_sdk',
        contextPattern: 'import',
        filePattern: `${testDir}/context-test.js`,
      });

      expect(results).toHaveLength(1);
      expect(results[0].matches).toHaveLength(2); // import line and initialize line
      expect(results[0].matches.some(m => m.content.includes('import'))).toBe(
        true
      );
    });

    test('should return empty results when no matches found', async () => {
      const results = await performSearch({
        searchPattern: 'nonexistent.*pattern',
        filePattern: `${testDir}/**/*.js`,
      });

      expect(results).toHaveLength(0);
    });

    test('should handle regex special characters', async () => {
      const results = await performSearch({
        searchPattern: 'TestInterface\\s*\\{',
        filePattern: `${testDir}/**/*.ts`,
      });

      expect(results).toHaveLength(1);
      expect(results[0].matches).toHaveLength(2); // Both interface and class have TestInterface
    });

    test('should find patterns across multiple lines', async () => {
      const results = await performSearch({
        searchPattern: 'const.*=',
        filePattern: `${testDir}/**/*.js`,
      });

      expect(results).toHaveLength(2); // test1.js and context-test.js
      expect(
        results.some(r => r.matches.some(m => m.content.includes('variable')))
      ).toBe(true);
    });
  });

  describe('formatSearchResults', () => {
    test('should format single result correctly', async () => {
      const results = await performSearch({
        searchPattern: 'function',
        filePattern: `${testDir}/test1.js`,
      });

      const formatted = formatSearchResults(results);
      expect(formatted).toContain('Search results:');
      expect(formatted).toContain(`${testDir}/test1.js`);
      expect(formatted).toContain('(line: 1, line: 6)');
    });

    test('should format empty results correctly', () => {
      const formatted = formatSearchResults([]);
      expect(formatted).toBe('No matches found for the given pattern');
    });

    test('should format multiple results correctly', async () => {
      const results = await performSearch({
        searchPattern: 'export',
        filePattern: `${testDir}/**/*.{js,ts}`,
      });

      const formatted = formatSearchResults(results);
      expect(formatted).toContain('Search results:');
      expect(formatted.split('\n').length).toBeGreaterThan(2);
    });

    test('should handle consecutive line numbers correctly', async () => {
      // Create a file with consecutive matches
      writeFileSync(
        `${testDir}/consecutive.js`,
        `const a = 1;
const b = 2;
const c = 3;
const d = 4;`
      );

      const results = await performSearch({
        searchPattern: 'const.*=',
        filePattern: `${testDir}/consecutive.js`,
      });

      const formatted = formatSearchResults(results);
      expect(formatted).toContain('lines: 1-4');
    });
  });

  describe('edge cases', () => {
    test('should handle files with no content', async () => {
      writeFileSync(`${testDir}/empty.js`, '');

      const results = await performSearch({
        searchPattern: 'anything',
        filePattern: `${testDir}/empty.js`,
      });

      expect(results).toHaveLength(0);
    });

    test('should handle invalid regex gracefully', async () => {
      await expect(
        performSearch({
          searchPattern: '[invalid regex',
          filePattern: `${testDir}/**/*.js`,
        })
      ).rejects.toThrow();
    });

    test('should handle non-existent file patterns', async () => {
      const results = await performSearch({
        searchPattern: 'function',
        filePattern: 'non-existent/**/*.js',
      });

      expect(results).toHaveLength(0);
    });

    test('should handle large files efficiently', async () => {
      // Create a large file
      const largeContent = 'function test() {}\n'.repeat(1000);
      writeFileSync(`${testDir}/large.js`, largeContent);

      const results = await performSearch({
        searchPattern: 'function test',
        filePattern: `${testDir}/large.js`,
      });

      expect(results).toHaveLength(1);
      expect(results[0].matches).toHaveLength(1000);
    });
  });
});
