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
    const testCases = [
      {
        name: 'should perform basic refactoring',
        options: {
          searchPattern: 'const (\\w+) = ',
          replacePattern: 'let $1 = ',
          filePattern: `${testDir}/variables.js`,
          dryRun: false,
        },
        expected: {
          resultCount: 1,
          filePath: `${testDir}/variables.js`,
          replacements: 3,
          modified: true,
          fileContains: [
            'let oldVariable = ',
            'let anotherOld = ',
            'let finalOld = ',
            'let someVar = ',
          ],
        },
      },
      {
        name: 'should perform dry-run without modifying files',
        options: {
          searchPattern: 'const (\\w+) = ',
          replacePattern: 'let $1 = ',
          filePattern: `${testDir}/variables.js`,
          dryRun: true,
        },
        expected: {
          resultCount: 1,
          replacements: 3,
          modified: true,
          fileUnchanged: true,
        },
      },
      {
        name: 'should work with capture groups',
        options: {
          searchPattern: 'function (\\w+)\\(',
          replacePattern: 'function new$1(',
          filePattern: `${testDir}/functions.ts`,
          dryRun: false,
        },
        expected: {
          resultCount: 1,
          replacements: 2,
          fileContains: [
            'function newoldFunction(',
            'function newexportedOldFunction(',
          ],
        },
      },
      {
        name: 'should work with context filtering',
        options: {
          searchPattern: 'legacy_sdk',
          replacePattern: 'new_sdk',
          contextPattern: 'import',
          filePattern: `${testDir}/context-test.js`,
          dryRun: false,
        },
        expected: {
          resultCount: 1,
          replacementsGreaterThan: 0,
          fileContains: ['import new_sdk from', 'legacy_sdk_local'],
        },
      },
      {
        name: 'should handle multiple files',
        options: {
          searchPattern: 'old',
          replacePattern: 'new',
          filePattern: `${testDir}/**/*.{js,ts}`,
          dryRun: false,
        },
        expected: {
          resultCountGreaterThan: 1,
          totalReplacementsGreaterThan: 0,
        },
      },
      {
        name: 'should return empty results when no matches found',
        options: {
          searchPattern: 'nonexistent.*pattern',
          replacePattern: 'replacement',
          filePattern: `${testDir}/**/*.js`,
          dryRun: false,
        },
        expected: {
          resultCount: 0,
        },
      },
      {
        name: 'should collect match information correctly',
        options: {
          searchPattern: 'const (\\w+)',
          replacePattern: 'let $1',
          filePattern: `${testDir}/variables.js`,
          dryRun: true,
        },
        expected: {
          resultCount: 1,
          matchCount: 3,
          matchProperties: ['line', 'content', 'original', 'replaced'],
          matchContentContains: ['const', 'let'],
        },
      },
    ];

    testCases.forEach(({ name, options, expected }) => {
      test(name, async () => {
        const originalContent = expected.fileUnchanged
          ? readFileSync(`${testDir}/variables.js`, 'utf-8')
          : null;

        const results = await performRefactor(options);

        if (expected.resultCount !== undefined) {
          expect(results).toHaveLength(expected.resultCount);
        }

        if (expected.resultCountGreaterThan !== undefined) {
          expect(results.length).toBeGreaterThan(
            expected.resultCountGreaterThan
          );
        }

        if (results.length > 0) {
          if (expected.filePath) {
            expect(results[0].filePath).toBe(expected.filePath);
          }

          if (expected.replacements !== undefined && results.length > 0) {
            expect(results[0].replacements).toBe(expected.replacements);
          }

          if (expected.replacementsGreaterThan !== undefined) {
            expect(results[0].replacements).toBeGreaterThan(
              expected.replacementsGreaterThan
            );
          }

          if (expected.modified !== undefined) {
            expect(results[0].modified).toBe(expected.modified);
          }

          if (expected.matchCount !== undefined) {
            expect(results[0].matches).toHaveLength(expected.matchCount);
          }

          if (expected.matchProperties) {
            const match = results[0].matches[0];
            expected.matchProperties.forEach(prop => {
              expect(match).toHaveProperty(prop);
            });
          }

          if (expected.matchContentContains) {
            const match = results[0].matches[0];
            const hasInOriginal = expected.matchContentContains.some(
              text => match.original && match.original.includes(text)
            );
            const hasInReplaced = expected.matchContentContains.some(
              text => match.replaced && match.replaced.includes(text)
            );
            expect(hasInOriginal || hasInReplaced).toBe(true);
          }
        }

        if (expected.totalReplacementsGreaterThan !== undefined) {
          const totalReplacements = results.reduce(
            (sum, result) => sum + result.replacements,
            0
          );
          expect(totalReplacements).toBeGreaterThan(
            expected.totalReplacementsGreaterThan
          );
        }

        if (expected.fileContains) {
          let filePath = options.filePattern;

          // Use the specific file based on the test case
          if (name.includes('capture groups')) {
            filePath = `${testDir}/functions.ts`;
          } else if (name.includes('context')) {
            filePath = `${testDir}/context-test.js`;
          } else if (name.includes('complex')) {
            filePath = `${testDir}/complex.js`;
          } else {
            // For basic refactoring and other tests
            filePath = `${testDir}/variables.js`;
          }

          const content = readFileSync(filePath, 'utf-8');
          expected.fileContains.forEach(text => {
            expect(content).toContain(text);
          });
        }

        if (expected.fileUnchanged && originalContent) {
          const content = readFileSync(`${testDir}/variables.js`, 'utf-8');
          expect(content).toBe(originalContent);
        }
      });
    });
  });

  describe('formatRefactorResults', () => {
    const testCases = [
      {
        name: 'should format single result correctly',
        setupFn: async () => {
          return await performRefactor({
            searchPattern: 'const',
            replacePattern: 'let',
            filePattern: `${testDir}/variables.js`,
            dryRun: true,
          });
        },
        isDryRun: false,
        expected: {
          contains: [
            'Refactoring completed:',
            `${testDir}/variables.js:`,
            'replacements',
            'Total:',
          ],
        },
      },
      {
        name: 'should format dry-run results correctly',
        setupFn: async () => {
          return await performRefactor({
            searchPattern: 'const',
            replacePattern: 'let',
            filePattern: `${testDir}/variables.js`,
            dryRun: true,
          });
        },
        isDryRun: true,
        expected: {
          contains: ['(dry run)'],
        },
      },
      {
        name: 'should format empty results correctly',
        setupFn: () => [],
        isDryRun: false,
        expected: {
          equals: 'No matches found for the given pattern',
        },
      },
      {
        name: 'should format multiple results correctly',
        setupFn: async () => {
          return await performRefactor({
            searchPattern: 'old',
            replacePattern: 'new',
            filePattern: `${testDir}/**/*.{js,ts}`,
            dryRun: true,
          });
        },
        isDryRun: false,
        expected: {
          contains: ['Refactoring completed:', 'Total:'],
          minLines: 3,
        },
      },
      {
        name: 'should calculate total replacements correctly',
        setupFn: async () => {
          return await performRefactor({
            searchPattern: 'old',
            replacePattern: 'new',
            filePattern: `${testDir}/**/*.{js,ts}`,
            dryRun: true,
          });
        },
        isDryRun: false,
        expected: {
          calculateTotal: true,
        },
      },
    ];

    testCases.forEach(({ name, setupFn, isDryRun, expected }) => {
      test(name, async () => {
        const results = await setupFn();
        const formatted = formatRefactorResults(results, isDryRun);

        if (expected.equals) {
          expect(formatted).toBe(expected.equals);
        }

        if (expected.contains) {
          expected.contains.forEach(text => {
            expect(formatted).toContain(text);
          });
        }

        if (expected.minLines) {
          expect(formatted.split('\n').length).toBeGreaterThan(
            expected.minLines
          );
        }

        if (expected.calculateTotal) {
          const totalReplacements = results.reduce(
            (sum, result) => sum + result.replacements,
            0
          );
          expect(formatted).toContain(
            `Total: ${totalReplacements} replacements`
          );
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
          replacePattern: 'replacement',
          filePattern: `${testDir}/empty.js`,
          dryRun: false,
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
          replacePattern: 'replacement',
          filePattern: `${testDir}/**/*.js`,
          dryRun: false,
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
          replacePattern: 'method',
          filePattern: 'non-existent/**/*.js',
          dryRun: false,
        },
        expected: {
          resultCount: 0,
        },
      },
      {
        name: 'should handle complex replacement patterns',
        setupFn: () => {
          writeFileSync(
            `${testDir}/complex.js`,
            `function getName() { return 'name'; }
function getAge() { return 25; }`
          );
        },
        options: {
          searchPattern: 'function get(\\w+)\\(\\)',
          replacePattern: 'const get$1 = ()',
          filePattern: `${testDir}/complex.js`,
          dryRun: false,
        },
        expected: {
          resultCount: 1,
          replacements: 2,
          fileContains: ['const getName = ()', 'const getAge = ()'],
        },
      },
      {
        name: 'should preserve file content when no matches',
        setupFn: null,
        options: {
          searchPattern: 'nonexistent',
          replacePattern: 'replacement',
          filePattern: `${testDir}/variables.js`,
          dryRun: false,
        },
        expected: {
          resultCount: 0,
          fileUnchanged: true,
        },
      },
    ];

    testCases.forEach(({ name, setupFn, options, expected }) => {
      test(name, async () => {
        const originalContent = expected.fileUnchanged
          ? readFileSync(`${testDir}/variables.js`, 'utf-8')
          : null;

        if (setupFn) {
          setupFn();
        }

        if (expected.shouldThrow) {
          await expect(performRefactor(options)).rejects.toThrow();
        } else {
          const results = await performRefactor(options);

          expect(results).toHaveLength(expected.resultCount);

          if (expected.replacements !== undefined && results.length > 0) {
            expect(results[0]?.replacements).toBe(expected.replacements);
          }

          if (expected.fileContains) {
            const content = readFileSync(`${testDir}/complex.js`, 'utf-8');
            expected.fileContains.forEach(text => {
              expect(content).toContain(text);
            });
          }

          if (expected.fileUnchanged && originalContent) {
            const content = readFileSync(`${testDir}/variables.js`, 'utf-8');
            expect(content).toBe(originalContent);
          }
        }
      });
    });
  });
});
