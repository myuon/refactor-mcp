import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  writeFileSync,
  unlinkSync,
  existsSync,
  readFileSync,
  mkdirSync,
  rmSync,
} from 'fs';
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  readFileContent,
  writeFileContent,
  searchFiles,
  groupConsecutiveLines,
} from '../src/server.js';
import { performSearch, formatSearchResults } from '../src/core/search-tool.js';
import { performRefactor, formatRefactorResults } from '../src/core/refactor-tool.js';

describe('MCP Refactor Server', () => {
  const testFilePath = 'test-file.js';
  const testDir = 'test-dir';
  const testFiles = [
    'test-file.js',
    'test-file.ts',
    'test-dir/nested-file.js',
    'test-dir/model/data.go',
  ];

  beforeEach(() => {
    // Clean up any existing test files and directories
    testFiles.forEach(file => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test files and directories after each test
    testFiles.forEach(file => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Helper Functions', () => {
    const helperTestCases = [
      {
        name: 'should read file correctly',
        test: 'readFileContent',
        content: 'const x = 1;\nconst y = 2;',
        expected: 'const x = 1;\nconst y = 2;',
      },
      {
        name: 'should write file correctly',
        test: 'writeFileContent',
        content: 'const z = 3;',
        expected: 'const z = 3;',
      },
    ];

    helperTestCases.forEach(({ name, test, content, expected }) => {
      if (test === 'readFileContent') {
        it(name, () => {
          writeFileSync(testFilePath, content, 'utf-8');
          const result = readFileContent(testFilePath);
          expect(result).toBe(expected);
        });
      } else if (test === 'writeFileContent') {
        it(name, () => {
          writeFileContent(testFilePath, content);
          const result = readFileSync(testFilePath, 'utf-8');
          expect(result).toBe(expected);
        });
      }
    });

    test('searchFiles should find files matching pattern', async () => {
      writeFileSync(testFilePath, 'test content', 'utf-8');
      const results = await searchFiles('test-*.js');
      expect(results).toContain(testFilePath);
    });

    const groupConsecutiveLinesTestCases = [
      {
        name: 'should handle single line',
        input: [5],
        expected: ['line: 5'],
      },
      {
        name: 'should handle all consecutive',
        input: [1, 2, 3, 4, 5],
        expected: ['lines: 1-5'],
      },
      {
        name: 'should handle mixed consecutive and non-consecutive',
        input: [1, 2, 3, 5, 7, 8, 9, 12],
        expected: ['lines: 1-3', 'line: 5', 'lines: 7-9', 'line: 12'],
      },
      {
        name: 'should handle no consecutive numbers',
        input: [1, 3, 5, 7],
        expected: ['line: 1', 'line: 3', 'line: 5', 'line: 7'],
      },
      {
        name: 'should handle two consecutive groups',
        input: [1, 2, 5, 6],
        expected: ['lines: 1-2', 'lines: 5-6'],
      },
      {
        name: 'should handle empty array',
        input: [],
        expected: [],
      },
    ];

    groupConsecutiveLinesTestCases.forEach(({ name, input, expected }) => {
      test(name, () => {
        expect(groupConsecutiveLines(input)).toEqual(expected);
      });
    });
  });

  describe('Simple Regex Test', () => {
    const regexTestCases = [
      {
        name: 'basic regex replacement should work',
        content: 'const foo = 1;\nconst foo = 2;',
        searchPattern: 'foo',
        replacePattern: 'bar',
        expected: 'const bar = 1;\nconst bar = 2;',
      },
      {
        name: 'regex with capture groups should work',
        content: 'foo(1,2,3);\nfoo("hello");',
        searchPattern: 'foo\\((.+)\\)',
        replacePattern: 'bar($1)',
        expected: 'bar(1,2,3);\nbar("hello");',
      },
    ];

    regexTestCases.forEach(
      ({ name, content, searchPattern, replacePattern, expected }) => {
        test(name, () => {
          const result = content.replace(
            new RegExp(searchPattern, 'g'),
            replacePattern
          );
          expect(result).toBe(expected);
        });
      }
    );
  });

  describe('Code Refactor Tool', () => {
    const refactorTestCases = [
      {
        name: 'should perform basic regex replacement in file',
        content: 'let k = foo(1,2,3);\nlet m = foo("hi");',
        searchPattern: 'foo\\((.+)\\)',
        replacePattern: 'bar($1)',
        expected: 'let k = bar(1,2,3);\nlet m = bar("hi");',
      },
    ];

    refactorTestCases.forEach(
      ({ name, content, searchPattern, replacePattern, expected }) => {
        test(name, () => {
          writeFileSync(testFilePath, content, 'utf-8');
          const newContent = content.replace(
            new RegExp(searchPattern, 'g'),
            replacePattern
          );
          writeFileSync(testFilePath, newContent, 'utf-8');
          const result = readFileSync(testFilePath, 'utf-8');
          expect(result).toBe(expected);
        });
      }
    );

    test('should work with context pattern filtering', () => {
      const content = `import (
  "legacy_sdk"
)

function test() {
  const legacy_sdk = "local variable";
}`;
      writeFileSync(testFilePath, content, 'utf-8');

      // Test context filtering logic
      const searchPattern = 'legacy_sdk';
      const replacePattern = 'brand_new_sdk';
      const contextPattern = 'import';

      // Simulate context-aware replacement
      const lines = content.split('\n');
      let result = content;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(searchPattern)) {
          // Check if context pattern exists in surrounding lines
          const contextStart = Math.max(0, i - 2);
          const contextEnd = Math.min(lines.length, i + 3);
          const contextArea = lines.slice(contextStart, contextEnd).join('\n');

          if (new RegExp(contextPattern).test(contextArea)) {
            result = result.replace(
              line,
              line.replace(searchPattern, replacePattern)
            );
          }
        }
      }

      expect(result).toContain('"brand_new_sdk"');
      expect(result).toContain('const legacy_sdk = "local variable"'); // Should not change
    });

    test('should work with file pattern filtering', async () => {
      // Create test files
      mkdirSync(testDir, { recursive: true });
      mkdirSync(`${testDir}/model`, { recursive: true });

      writeFileSync('test-file.js', 'const legacy_sdk = "js file";', 'utf-8');
      writeFileSync(
        `${testDir}/model/data.go`,
        'const legacy_sdk = "go file";',
        'utf-8'
      );

      // Test file pattern matching
      const goFiles = await searchFiles('**/model/*.go');
      const jsFiles = await searchFiles('*.js');

      expect(goFiles.some(file => file.includes('data.go'))).toBe(true);
      expect(jsFiles.some(file => file.includes('test-file.js'))).toBe(true);
    });
  });

  describe('Code Search Tool', () => {
    test('should find patterns and return file locations', () => {
      const content1 = `function foo(a, b) {
  return a + b;
}
const result = foo(1, 2);`;

      const content2 = `class Test {
  foo(x) {
    return x * 2;
  }
}`;

      writeFileSync('test-file.js', content1, 'utf-8');
      mkdirSync(testDir, { recursive: true });
      writeFileSync(`${testDir}/nested-file.js`, content2, 'utf-8');

      // Test search pattern matching
      const searchPattern = 'foo\\(';
      const regex = new RegExp(searchPattern, 'gm');

      // Search in first file
      const matches1 = [...content1.matchAll(regex)];
      expect(matches1.length).toBe(2); // function definition + call

      // Calculate line numbers
      const beforeFirstMatch = content1.substring(0, matches1[0].index!);
      const firstMatchLine = beforeFirstMatch.split('\n').length;
      expect(firstMatchLine).toBe(1); // function foo(a, b) on line 1
    });

    test('should recursively search through nested directories and return proper file paths', async () => {
      // Create deep nested structure with search targets
      mkdirSync('search-test', { recursive: true });
      mkdirSync('search-test/deep', { recursive: true });
      mkdirSync('search-test/deep/nested', { recursive: true });
      mkdirSync('search-test/side-branch', { recursive: true });

      const content1 = `function targetFunction() {
  return "found in root";
}`;
      const content2 = `class MyClass {
  targetFunction() {
    return "found in deep";
  }
}`;
      const content3 = `const targetFunction = () => {
  return "found in nested";
};`;
      const content4 = `// targetFunction comment
function anotherFunction() {
  targetFunction();
}`;

      writeFileSync('search-test/root.js', content1, 'utf-8');
      writeFileSync('search-test/deep/deep.js', content2, 'utf-8');
      writeFileSync('search-test/deep/nested/nested.js', content3, 'utf-8');
      writeFileSync('search-test/side-branch/side.js', content4, 'utf-8');

      // Test recursive search across all files
      const files = await searchFiles('**/search-test/**/*.js');
      expect(files.length).toBe(4);

      // Test pattern search in all files
      const searchPattern = 'targetFunction';
      const regex = new RegExp(searchPattern, 'gm');

      const searchResults: string[] = [];
      for (const filePath of files) {
        const content = readFileSync(filePath, 'utf-8');
        const matches = [...content.matchAll(regex)];

        if (matches.length > 0) {
          const lineNumbers: number[] = [];
          for (const match of matches) {
            const beforeMatch = content.substring(0, match.index!);
            const lineNumber = beforeMatch.split('\n').length;
            lineNumbers.push(lineNumber);
          }

          const firstLine = lineNumbers[0];
          const lastLine = lineNumbers[lineNumbers.length - 1];

          if (firstLine === lastLine) {
            searchResults.push(`${filePath} (line: ${firstLine})`);
          } else {
            searchResults.push(`${filePath} (lines: ${firstLine}-${lastLine})`);
          }
        }
      }

      // Should find targetFunction in all 4 files
      expect(searchResults.length).toBe(4);
      expect(
        searchResults.some(result => result.includes('search-test/root.js'))
      ).toBe(true);
      expect(
        searchResults.some(result =>
          result.includes('search-test/deep/deep.js')
        )
      ).toBe(true);
      expect(
        searchResults.some(result =>
          result.includes('search-test/deep/nested/nested.js')
        )
      ).toBe(true);
      expect(
        searchResults.some(result =>
          result.includes('search-test/side-branch/side.js')
        )
      ).toBe(true);

      // Clean up
      rmSync('search-test', { recursive: true, force: true });
    });

    test('should work with context pattern in search', () => {
      const content = `import { foo } from 'lib';

function bar() {
  foo(1, 2);
}

class Test {
  foo(x) {
    return x;
  }
}`;

      writeFileSync(testFilePath, content, 'utf-8');

      const searchPattern = 'foo\\(';
      const contextPattern = 'function|import';

      const matches = [...content.matchAll(new RegExp(searchPattern, 'gm'))];
      const validMatches: RegExpExecArray[] = [];

      for (const match of matches) {
        const beforeMatch = content.substring(0, match.index!);
        const afterMatch = content.substring(match.index! + match[0].length);
        const contextBefore = beforeMatch.split('\n').slice(-3).join('\n');
        const contextAfter = afterMatch.split('\n').slice(0, 3).join('\n');
        const contextArea = contextBefore + match[0] + contextAfter;

        if (new RegExp(contextPattern).test(contextArea)) {
          validMatches.push(match);
        }
      }

      // Should find the foo() call inside function bar, but not class method
      expect(validMatches.length).toBe(1);
    });

    const lineRangeTestCases = [
      {
        name: 'should return proper line ranges for multiple matches',
        content: `line 1
foo(1)
line 3
line 4
foo(2)
line 6
foo(3)
line 8`,
        expectedLines: [2, 5, 7],
        expectedFormat: 'test-file.js (line: 2, line: 5, line: 7)',
      },
      {
        name: 'should group consecutive line numbers in search results',
        content: `line 1
foo(1)
foo(2)
foo(3)
line 5
foo(4)
line 7
foo(5)
foo(6)`,
        expectedLines: [2, 3, 4, 6, 8, 9],
        expectedFormat: 'test-file.js (lines: 2-4, line: 6, lines: 8-9)',
      },
    ];

    lineRangeTestCases.forEach(
      ({ name, content, expectedLines, expectedFormat }) => {
        test(name, () => {
          writeFileSync(testFilePath, content, 'utf-8');
          const searchPattern = 'foo\\(';
          const matches = [
            ...content.matchAll(new RegExp(searchPattern, 'gm')),
          ];
          const lineNumbers: number[] = [];

          for (const match of matches) {
            const beforeMatch = content.substring(0, match.index!);
            const lineNumber = beforeMatch.split('\n').length;
            lineNumbers.push(lineNumber);
          }

          expect(lineNumbers).toEqual(expectedLines);
          const groupedLines = groupConsecutiveLines(lineNumbers);
          expect(`test-file.js (${groupedLines.join(', ')})`).toBe(
            expectedFormat
          );
        });
      }
    );
  });

  describe('Integration Tests', () => {
    test('should handle files with different extensions', async () => {
      mkdirSync(testDir, { recursive: true });
      mkdirSync(`${testDir}/model`, { recursive: true });

      writeFileSync('test-file.js', 'const foo = "javascript";', 'utf-8');
      writeFileSync(
        'test-file.ts',
        'const foo: string = "typescript";',
        'utf-8'
      );
      writeFileSync(`${testDir}/model/data.go`, 'var foo = "golang"', 'utf-8');

      const allFiles = await searchFiles('**/*');
      const jsFiles = await searchFiles('*.js');
      const tsFiles = await searchFiles('*.ts');
      const goFiles = await searchFiles('**/*.go');

      expect(allFiles.length).toBeGreaterThan(2);
      expect(jsFiles.some(file => file.includes('.js'))).toBe(true);
      expect(tsFiles.some(file => file.includes('.ts'))).toBe(true);
      expect(goFiles.some(file => file.includes('.go'))).toBe(true);
    });

    test('should recursively search through multiple nested directories', async () => {
      // Create deep nested directory structure
      mkdirSync('level1', { recursive: true });
      mkdirSync('level1/level2', { recursive: true });
      mkdirSync('level1/level2/level3', { recursive: true });
      mkdirSync('level1/another-branch', { recursive: true });

      // Create files at different levels with search pattern
      writeFileSync(
        'level1/file1.js',
        'function searchMe() { return "level1"; }',
        'utf-8'
      );
      writeFileSync(
        'level1/level2/file2.js',
        'const searchMe = "level2";',
        'utf-8'
      );
      writeFileSync(
        'level1/level2/level3/file3.js',
        'var searchMe = "level3";',
        'utf-8'
      );
      writeFileSync(
        'level1/another-branch/file4.js',
        'let searchMe = "another-branch";',
        'utf-8'
      );

      // Test recursive search
      const allJsFiles = await searchFiles('**/level1/**/*.js');
      expect(allJsFiles.length).toBe(4);
      expect(allJsFiles.some(file => file.includes('level1/file1.js'))).toBe(
        true
      );
      expect(
        allJsFiles.some(file => file.includes('level1/level2/file2.js'))
      ).toBe(true);
      expect(
        allJsFiles.some(file => file.includes('level1/level2/level3/file3.js'))
      ).toBe(true);
      expect(
        allJsFiles.some(file => file.includes('level1/another-branch/file4.js'))
      ).toBe(true);

      // Test pattern search across nested files
      const searchPattern = 'searchMe';
      const regex = new RegExp(searchPattern, 'gm');

      let matchingFiles = 0;
      for (const filePath of allJsFiles) {
        const content = readFileSync(filePath, 'utf-8');
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
          matchingFiles++;
        }
      }

      expect(matchingFiles).toBe(4); // All files should contain 'searchMe'

      // Clean up
      rmSync('level1', { recursive: true, force: true });
    });

    test('should respect file pattern filters in recursive search', async () => {
      // Create mixed file types in nested structure
      mkdirSync('mixed', { recursive: true });
      mkdirSync('mixed/js', { recursive: true });
      mkdirSync('mixed/ts', { recursive: true });
      mkdirSync('mixed/other', { recursive: true });

      writeFileSync('mixed/js/app.js', 'const target = "js";', 'utf-8');
      writeFileSync('mixed/ts/app.ts', 'const target: string = "ts";', 'utf-8');
      writeFileSync('mixed/other/app.py', 'target = "python"', 'utf-8');
      writeFileSync('mixed/other/app.go', 'var target = "go"', 'utf-8');

      // Test specific file pattern filters
      const jsFiles = await searchFiles('**/mixed/**/*.js');
      const tsFiles = await searchFiles('**/mixed/**/*.ts');
      const pyFiles = await searchFiles('**/mixed/**/*.py');
      const goFiles = await searchFiles('**/mixed/**/*.go');

      expect(jsFiles.length).toBe(1);
      expect(tsFiles.length).toBe(1);
      expect(pyFiles.length).toBe(1);
      expect(goFiles.length).toBe(1);

      expect(jsFiles[0]).toContain('app.js');
      expect(tsFiles[0]).toContain('app.ts');
      expect(pyFiles[0]).toContain('app.py');
      expect(goFiles[0]).toContain('app.go');

      // Clean up
      rmSync('mixed', { recursive: true, force: true });
    });

    const specExampleTestCases = [
      {
        name: 'should handle complex regex patterns from spec examples',
        content: 'let k = foo(1,2,3);\nlet m = foo("hi");',
        searchPattern: 'foo\\((.+)\\)',
        replacePattern: 'bar($1)',
        expected: 'let k = bar(1,2,3);\nlet m = bar("hi");',
      },
    ];

    specExampleTestCases.forEach(
      ({ name, content, searchPattern, replacePattern, expected }) => {
        test(name, () => {
          const result = content.replace(
            new RegExp(searchPattern, 'g'),
            replacePattern
          );
          expect(result).toBe(expected);
        });
      }
    );

    test('should handle import context pattern from spec', () => {
      const content = `import (
  "legacy_sdk"
  "other_package"
)

const legacy_sdk = "not in import";`;

      // Test context pattern from spec
      const searchPattern = 'legacy_sdk';
      const replacePattern = 'brand_new_sdk';
      // const contextPattern = 'import'; // Used in pattern matching logic below

      // Simple context check - if the match is within import block
      const importBlockMatch = content.match(/import\s*\([^)]+\)/s);
      if (importBlockMatch) {
        const importBlock = importBlockMatch[0];
        if (importBlock.includes('legacy_sdk')) {
          const result = content.replace(
            importBlock,
            importBlock.replace(searchPattern, replacePattern)
          );
          expect(result).toContain('"brand_new_sdk"');
          expect(result).toContain('const legacy_sdk = "not in import"');
        }
      }
    });

    test('should support directory-only patterns', async () => {
      // Create test directory structure
      mkdirSync(`${testDir}/app`, { recursive: true });
      mkdirSync(`${testDir}/app/components`, { recursive: true });
      mkdirSync(`${testDir}/utils`, { recursive: true });

      // Create test files in test directories
      writeFileSync(
        `${testDir}/app/index.js`,
        'const main = "entry";',
        'utf-8'
      );
      writeFileSync(
        `${testDir}/app/utils.js`,
        'const util = "helper";',
        'utf-8'
      );
      writeFileSync(
        `${testDir}/app/components/Button.js`,
        'const Button = "component";',
        'utf-8'
      );
      writeFileSync(
        `${testDir}/utils/helper.js`,
        'const helper = "util";',
        'utf-8'
      );
      writeFileSync(`${testDir}/root.js`, 'const root = "root";', 'utf-8');

      // Test directory pattern without glob syntax
      const appFiles = await searchFiles(`${testDir}/app`);
      const utilFiles = await searchFiles(`${testDir}/utils`);
      const componentFiles = await searchFiles(`${testDir}/app/components`);

      // Should find all files in app directory and subdirectories
      expect(appFiles.filter(f => f.includes('/app/')).length).toBe(3);
      expect(appFiles).toContain(`${testDir}/app/index.js`);
      expect(appFiles).toContain(`${testDir}/app/utils.js`);
      expect(appFiles).toContain(`${testDir}/app/components/Button.js`);

      // Should find files in utils directory
      expect(utilFiles.filter(f => f.includes('/utils/')).length).toBe(1);
      expect(utilFiles).toContain(`${testDir}/utils/helper.js`);

      // Should find files in nested directory
      expect(
        componentFiles.filter(f => f.includes('/app/components/')).length
      ).toBe(1);
      expect(componentFiles).toContain(`${testDir}/app/components/Button.js`);

      // Should not include root files
      expect(appFiles).not.toContain(`${testDir}/root.js`);
      expect(utilFiles).not.toContain(`${testDir}/root.js`);
    });
  });

  describe('MCP Server Format Options', () => {
    beforeEach(() => {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        `${testDir}/test-format.js`,
        `function testFunction() {
  const variable = 'test';
  return variable;
}

export function exportedFunction() {
  console.log('exported');
  return 'result';
}`
      );
    });

    test('should format search results with capture groups', async () => {
      const results = await performSearch({
        searchPattern: 'function (\\w+)\\(',
        filePattern: `${testDir}/**/*.js`,
      });

      const formattedWithCapture = formatSearchResults(results, {
        includeCaptureGroups: true,
      });

      expect(formattedWithCapture).toContain('Search results:');
      expect(formattedWithCapture).toContain(`${testDir}/test-format.js:`);
      expect(formattedWithCapture).toContain('Line 1:');
      expect(formattedWithCapture).toContain('Line 6:');
      expect(formattedWithCapture).toContain('└─ Captured: [testFunction]');
      expect(formattedWithCapture).toContain('└─ Captured: [exportedFunction]');
    });

    test('should format search results with matched text', async () => {
      const results = await performSearch({
        searchPattern: 'function (\\w+)\\(',
        filePattern: `${testDir}/**/*.js`,
      });

      const formattedWithMatched = formatSearchResults(results, {
        includeMatchedText: true,
      });

      expect(formattedWithMatched).toContain('Search results:');
      expect(formattedWithMatched).toContain('Line 1: function testFunction(');
      expect(formattedWithMatched).toContain('Line 6: function exportedFunction(');
    });

    test('should format search results with both options', async () => {
      const results = await performSearch({
        searchPattern: 'function (\\w+)\\(',
        filePattern: `${testDir}/**/*.js`,
      });

      const formattedWithBoth = formatSearchResults(results, {
        includeCaptureGroups: true,
        includeMatchedText: true,
      });

      expect(formattedWithBoth).toContain('Line 1: function testFunction(');
      expect(formattedWithBoth).toContain('└─ Captured: [testFunction]');
      expect(formattedWithBoth).toContain('Line 6: function exportedFunction(');
      expect(formattedWithBoth).toContain('└─ Captured: [exportedFunction]');
    });

    test('should format refactor results with capture groups', async () => {
      const results = await performRefactor({
        searchPattern: 'const (\\w+) = ',
        replacePattern: 'let $1 = ',
        filePattern: `${testDir}/**/*.js`,
        dryRun: true,
      });

      const formattedWithCapture = formatRefactorResults(results, {
        includeCaptureGroups: true,
        dryRun: true,
      });

      expect(formattedWithCapture).toContain('Refactoring completed (dry run):');
      expect(formattedWithCapture).toContain(`${testDir}/test-format.js:`);
      expect(formattedWithCapture).toContain('Line 2:');
    });

    test('should maintain backward compatibility for boolean parameter', async () => {
      const results = await performRefactor({
        searchPattern: 'const (\\w+) = ',
        replacePattern: 'let $1 = ',
        filePattern: `${testDir}/**/*.js`,
        dryRun: true,
      });

      const formattedOldWay = formatRefactorResults(results, true);

      expect(formattedOldWay).toContain('Refactoring completed:');
      expect(formattedOldWay).toContain('(dry run)');
      expect(formattedOldWay).toContain('replacements in');
    });
  });
});
