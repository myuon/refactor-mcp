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
    const testCases = [
      {
        name: 'should find basic function patterns',
        options: {
          searchPattern: 'function.*\\(',
          filePattern: `${testDir}/**/*.js`,
        },
        expected: {
          resultCount: 1,
          filePath: `${testDir}/test1.js`,
          matchCount: 2,
          lineNumbers: [1, 6],
          groupedLines: ['line: 1', 'line: 6'],
        },
      },
      {
        name: 'should find patterns with file filtering',
        options: {
          searchPattern: 'export.*',
          filePattern: `${testDir}/**/*.{js,ts}`,
        },
        expected: {
          resultCount: 2,
          hasTest1: true,
          hasTest2: true,
        },
      },
      {
        name: 'should work with context filtering',
        options: {
          searchPattern: 'legacy_sdk',
          contextPattern: 'import',
          filePattern: `${testDir}/context-test.js`,
        },
        expected: {
          resultCount: 1,
          matchCount: 2,
          hasImport: true,
        },
      },
      {
        name: 'should return empty results when no matches found',
        options: {
          searchPattern: 'nonexistent.*pattern',
          filePattern: `${testDir}/**/*.js`,
        },
        expected: {
          resultCount: 0,
        },
      },
      {
        name: 'should handle regex special characters',
        options: {
          searchPattern: 'TestInterface\\s*\\{',
          filePattern: `${testDir}/**/*.ts`,
        },
        expected: {
          resultCount: 1,
          matchCount: 2,
        },
      },
      {
        name: 'should find patterns across multiple lines',
        options: {
          searchPattern: 'const.*=',
          filePattern: `${testDir}/**/*.js`,
        },
        expected: {
          resultCount: 2,
          hasVariable: true,
        },
      },
    ];

    testCases.forEach(({ name, options, expected }) => {
      test(name, async () => {
        const results = await performSearch(options);

        expect(results).toHaveLength(expected.resultCount);

        if (expected.filePath) {
          expect(results[0].filePath).toBe(expected.filePath);
        }

        if (expected.matchCount) {
          expect(results[0].matches).toHaveLength(expected.matchCount);
        }

        if (expected.lineNumbers) {
          expect(results[0].lineNumbers).toEqual(expected.lineNumbers);
        }

        if (expected.groupedLines) {
          expect(results[0].groupedLines).toEqual(expected.groupedLines);
        }

        if (expected.hasTest1) {
          expect(results.some(r => r.filePath.endsWith('test1.js'))).toBe(true);
        }

        if (expected.hasTest2) {
          expect(results.some(r => r.filePath.endsWith('test2.ts'))).toBe(true);
        }

        if (expected.hasImport) {
          expect(results[0].matches.some(m => m.content.includes('import'))).toBe(true);
        }

        if (expected.hasVariable) {
          expect(
            results.some(r => r.matches.some(m => m.content.includes('variable')))
          ).toBe(true);
        }
      });
    });
  });

  describe('formatSearchResults', () => {
    const testCases = [
      {
        name: 'should format single result correctly',
        setupFn: async () => {
          return await performSearch({
            searchPattern: 'function',
            filePattern: `${testDir}/test1.js`,
          });
        },
        expected: {
          contains: ['Search results:', `${testDir}/test1.js`, '(line: 1, line: 6)'],
        },
      },
      {
        name: 'should format empty results correctly',
        setupFn: () => [],
        expected: {
          equals: 'No matches found for the given pattern',
        },
      },
      {
        name: 'should format multiple results correctly',
        setupFn: async () => {
          return await performSearch({
            searchPattern: 'export',
            filePattern: `${testDir}/**/*.{js,ts}`,
          });
        },
        expected: {
          contains: ['Search results:'],
          minLines: 2,
        },
      },
      {
        name: 'should handle consecutive line numbers correctly',
        setupFn: async () => {
          writeFileSync(
            `${testDir}/consecutive.js`,
            `const a = 1;
const b = 2;
const c = 3;
const d = 4;`
          );
          return await performSearch({
            searchPattern: 'const.*=',
            filePattern: `${testDir}/consecutive.js`,
          });
        },
        expected: {
          contains: ['lines: 1-4'],
        },
      },
    ];

    testCases.forEach(({ name, setupFn, expected }) => {
      test(name, async () => {
        const results = await setupFn();
        const formatted = formatSearchResults(results);

        if (expected.equals) {
          expect(formatted).toBe(expected.equals);
        }

        if (expected.contains) {
          expected.contains.forEach(text => {
            expect(formatted).toContain(text);
          });
        }

        if (expected.minLines) {
          expect(formatted.split('\n').length).toBeGreaterThan(expected.minLines);
        }
      });
    });
  });

  describe('edge cases', () => {
    const testCases = [
      {
        name: 'should handle files with no content',
        setupFn: () => {
          writeFileSync(`${testDir}/empty.js`, '');
        },
        options: {
          searchPattern: 'anything',
          filePattern: `${testDir}/empty.js`,
        },
        expected: {
          resultCount: 0,
        },
      },
      {
        name: 'should handle invalid regex gracefully',
        setupFn: null,
        options: {
          searchPattern: '[invalid regex',
          filePattern: `${testDir}/**/*.js`,
        },
        expected: {
          shouldThrow: true,
        },
      },
      {
        name: 'should handle non-existent file patterns',
        setupFn: null,
        options: {
          searchPattern: 'function',
          filePattern: 'non-existent/**/*.js',
        },
        expected: {
          resultCount: 0,
        },
      },
      {
        name: 'should handle large files efficiently',
        setupFn: () => {
          const largeContent = 'function test() {}\n'.repeat(1000);
          writeFileSync(`${testDir}/large.js`, largeContent);
        },
        options: {
          searchPattern: 'function test',
          filePattern: `${testDir}/large.js`,
        },
        expected: {
          resultCount: 1,
          matchCount: 1000,
        },
      },
    ];

    testCases.forEach(({ name, setupFn, options, expected }) => {
      test(name, async () => {
        if (setupFn) {
          setupFn();
        }

        if (expected.shouldThrow) {
          await expect(performSearch(options)).rejects.toThrow();
        } else {
          const results = await performSearch(options);
          expect(results).toHaveLength(expected.resultCount);

          if (expected.matchCount) {
            expect(results[0].matches).toHaveLength(expected.matchCount);
          }
        }
      });
    });
  });
});
