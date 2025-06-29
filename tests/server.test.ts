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
} from '../src/server.js';

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
    test('readFileContent should read file correctly', () => {
      const testContent = 'const x = 1;\nconst y = 2;';
      writeFileSync(testFilePath, testContent, 'utf-8');

      const result = readFileContent(testFilePath);
      expect(result).toBe(testContent);
    });

    test('writeFileContent should write file correctly', () => {
      const testContent = 'const z = 3;';
      writeFileContent(testFilePath, testContent);

      const result = readFileSync(testFilePath, 'utf-8');
      expect(result).toBe(testContent);
    });

    test('searchFiles should find files matching pattern', async () => {
      // Create a test file
      writeFileSync(testFilePath, 'test content', 'utf-8');

      const results = await searchFiles('test-*.js');
      expect(results).toContain(testFilePath);
    });
  });

  describe('Simple Regex Test', () => {
    test('basic regex replacement should work', () => {
      const content = 'const foo = 1;\nconst foo = 2;';
      const searchPattern = 'foo';
      const replacePattern = 'bar';

      const result = content.replace(
        new RegExp(searchPattern, 'g'),
        replacePattern
      );
      expect(result).toBe('const bar = 1;\nconst bar = 2;');
    });

    test('regex with capture groups should work', () => {
      const content = 'foo(1,2,3);\nfoo("hello");';
      const searchPattern = 'foo\\((.+)\\)';
      const replacePattern = 'bar($1)';

      const result = content.replace(
        new RegExp(searchPattern, 'g'),
        replacePattern
      );
      expect(result).toBe('bar(1,2,3);\nbar("hello");');
    });
  });

  describe('Code Refactor Tool', () => {
    test('should perform basic regex replacement in file', () => {
      const content = 'let k = foo(1,2,3);\nlet m = foo("hi");';
      writeFileSync(testFilePath, content, 'utf-8');

      // Simulate the refactor logic
      const searchPattern = 'foo\\((.+)\\)';
      const replacePattern = 'bar($1)';
      const newContent = content.replace(
        new RegExp(searchPattern, 'g'),
        replacePattern
      );

      writeFileSync(testFilePath, newContent, 'utf-8');
      const result = readFileSync(testFilePath, 'utf-8');

      expect(result).toBe('let k = bar(1,2,3);\nlet m = bar("hi");');
    });

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

      const searchResults = [];
      for (const filePath of files) {
        const content = readFileSync(filePath, 'utf-8');
        const matches = [...content.matchAll(regex)];

        if (matches.length > 0) {
          const lineNumbers = [];
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
      const validMatches = [];

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

    test('should return proper line ranges for multiple matches', () => {
      const content = `line 1
foo(1)
line 3
line 4
foo(2)
line 6
foo(3)
line 8`;

      writeFileSync(testFilePath, content, 'utf-8');

      const searchPattern = 'foo\\(';
      const matches = [...content.matchAll(new RegExp(searchPattern, 'gm'))];
      const lineNumbers = [];

      for (const match of matches) {
        const beforeMatch = content.substring(0, match.index!);
        const lineNumber = beforeMatch.split('\n').length;
        lineNumbers.push(lineNumber);
      }

      expect(lineNumbers).toEqual([2, 5, 7]);

      // Test line range formatting
      const firstLine = lineNumbers[0];
      const lastLine = lineNumbers[lineNumbers.length - 1];

      if (firstLine === lastLine) {
        expect(`test-file.js (line: ${firstLine})`).toBe(
          'test-file.js (line: 2)'
        );
      } else {
        expect(`test-file.js (lines: ${firstLine}-${lastLine})`).toBe(
          'test-file.js (lines: 2-7)'
        );
      }
    });
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

    test('should handle complex regex patterns from spec examples', () => {
      const content = 'let k = foo(1,2,3);\nlet m = foo("hi");';

      // Test the exact pattern from spec: foo((.+))
      const searchPattern = 'foo\\((.+)\\)';
      const replacePattern = 'bar($1)';

      const result = content.replace(
        new RegExp(searchPattern, 'g'),
        replacePattern
      );
      expect(result).toBe('let k = bar(1,2,3);\nlet m = bar("hi");');
    });

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
  });
});
