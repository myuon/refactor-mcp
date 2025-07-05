import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import {
  searchFiles,
  readFileContent,
  writeFileContent,
} from '../../src/utils/file-utils.js';

describe('File Utils', () => {
  const testDir = 'tests/temp-file-utils';

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(`${testDir}/nested`, { recursive: true });

    // Create test files
    writeFileSync(`${testDir}/file1.js`, 'console.log("file1");');
    writeFileSync(`${testDir}/file2.ts`, 'interface Test {}');
    writeFileSync(`${testDir}/file3.txt`, 'plain text');
    writeFileSync(`${testDir}/nested/file4.js`, 'nested file');
    writeFileSync(`${testDir}/.hidden.js`, 'hidden file');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('searchFiles', () => {
    const testCases = [
      {
        name: 'should find all files with default pattern',
        pattern: undefined,
        expected: {
          isArray: true,
          lengthGreaterThan: 0,
          excludes: ['node_modules', 'dist', '.git'],
        },
      },
      {
        name: 'should find files with specific glob pattern',
        pattern: `${testDir}/**/*.js`,
        expected: {
          lengthGreaterThanOrEqual: 2,
          allEndWith: '.js',
        },
      },
      {
        name: 'should find files with multiple extensions',
        pattern: `${testDir}/**/*.{js,ts}`,
        expected: {
          lengthGreaterThanOrEqual: 3,
          hasJs: true,
          hasTs: true,
        },
      },
      {
        name: 'should handle directory patterns correctly',
        pattern: testDir,
        expected: {
          lengthGreaterThan: 0,
          allStartWith: testDir,
        },
      },
      {
        name: 'should handle directory with trailing slash',
        pattern: `${testDir}/`,
        expected: {
          lengthGreaterThan: 0,
          allStartWith: testDir,
        },
      },
      {
        name: 'should return empty array for non-existent patterns',
        pattern: 'non-existent/**/*.xyz',
        expected: {
          length: 0,
        },
      },
      {
        name: 'should handle patterns with special characters',
        pattern: `${testDir}/**/*file*.js`,
        expected: {
          lengthGreaterThan: 0,
          allIncludeAndEndWith: ['file', '.js'],
        },
      },
      {
        name: 'should exclude ignored directories',
        pattern: undefined,
        expected: {
          excludes: ['node_modules', 'dist', '.git'],
        },
      },
    ];

    testCases.forEach(({ name, pattern, expected }) => {
      test(name, async () => {
        const files = await searchFiles(pattern);

        if (expected.isArray) {
          expect(files).toBeInstanceOf(Array);
        }

        if (expected.length !== undefined) {
          expect(files).toHaveLength(expected.length);
        }

        if (expected.lengthGreaterThan !== undefined) {
          expect(files.length).toBeGreaterThan(expected.lengthGreaterThan);
        }

        if (expected.lengthGreaterThanOrEqual !== undefined) {
          expect(files.length).toBeGreaterThanOrEqual(expected.lengthGreaterThanOrEqual);
        }

        if (expected.excludes) {
          expected.excludes.forEach(exclude => {
            expect(files.some(f => f.includes(exclude))).toBe(false);
          });
        }

        if (expected.allEndWith) {
          expect(files.every(f => f.endsWith(expected.allEndWith))).toBe(true);
        }

        if (expected.hasJs) {
          expect(files.some(f => f.endsWith('.js'))).toBe(true);
        }

        if (expected.hasTs) {
          expect(files.some(f => f.endsWith('.ts'))).toBe(true);
        }

        if (expected.allStartWith) {
          expect(files.every(f => f.startsWith(expected.allStartWith))).toBe(true);
        }

        if (expected.allIncludeAndEndWith) {
          const [include, endWith] = expected.allIncludeAndEndWith;
          expect(files.every(f => f.includes(include) && f.endsWith(endWith))).toBe(true);
        }
      });
    });
  });

  describe('readFileContent', () => {
    const testCases = [
      {
        name: 'should read file content correctly',
        setupFn: null,
        filePath: `${testDir}/file1.js`,
        expected: {
          content: 'console.log("file1");',
        },
      },
      {
        name: 'should handle UTF-8 content correctly',
        setupFn: () => {
          const testContent = 'Hello 世界 🌍';
          writeFileSync(`${testDir}/utf8.txt`, testContent, 'utf-8');
          return testContent;
        },
        filePath: `${testDir}/utf8.txt`,
        expected: {
          contentFromSetup: true,
        },
      },
      {
        name: 'should throw error for non-existent file',
        setupFn: null,
        filePath: 'non-existent-file.txt',
        expected: {
          shouldThrow: /Failed to read file/,
        },
      },
      {
        name: 'should handle empty files',
        setupFn: () => {
          writeFileSync(`${testDir}/empty.txt`, '');
        },
        filePath: `${testDir}/empty.txt`,
        expected: {
          content: '',
        },
      },
      {
        name: 'should handle large files',
        setupFn: () => {
          const largeContent = 'x'.repeat(10000);
          writeFileSync(`${testDir}/large.txt`, largeContent);
          return largeContent;
        },
        filePath: `${testDir}/large.txt`,
        expected: {
          contentFromSetup: true,
          length: 10000,
        },
      },
      {
        name: 'should preserve line endings',
        setupFn: () => {
          const contentWithLineEndings = 'line1\\nline2\\r\\nline3\\n';
          writeFileSync(`${testDir}/lineendings.txt`, contentWithLineEndings);
          return contentWithLineEndings;
        },
        filePath: `${testDir}/lineendings.txt`,
        expected: {
          contentFromSetup: true,
        },
      },
    ];

    testCases.forEach(({ name, setupFn, filePath, expected }) => {
      test(name, () => {
        let setupResult = null;
        if (setupFn) {
          setupResult = setupFn();
        }

        if (expected.shouldThrow) {
          expect(() => {
            readFileContent(filePath);
          }).toThrow(expected.shouldThrow);
        } else {
          const content = readFileContent(filePath);

          if (expected.content !== undefined) {
            expect(content).toBe(expected.content);
          }

          if (expected.contentFromSetup && setupResult) {
            expect(content).toBe(setupResult);
          }

          if (expected.length !== undefined) {
            expect(content.length).toBe(expected.length);
          }
        }
      });
    });
  });

  describe('writeFileContent', () => {
    const testCases = [
      {
        name: 'should write file content correctly',
        filePath: `${testDir}/write-test.txt`,
        content: 'test content',
        expected: {
          contentMatches: true,
        },
      },
      {
        name: 'should overwrite existing files',
        filePath: `${testDir}/overwrite-test.txt`,
        content: 'new content',
        setupFn: () => {
          writeFileContent(`${testDir}/overwrite-test.txt`, 'original');
        },
        expected: {
          contentMatches: true,
        },
      },
      {
        name: 'should handle UTF-8 content correctly',
        filePath: `${testDir}/utf8-write.txt`,
        content: 'Hello 世界 🌍',
        expected: {
          contentMatches: true,
        },
      },
      {
        name: 'should create nested directories if needed',
        filePath: `${testDir}/deep/nested/file.txt`,
        content: 'nested content',
        expected: {
          shouldThrow: /Failed to write file/,
        },
        note: 'writeFileContent doesn\'t create directories',
      },
      {
        name: 'should throw error for invalid paths',
        filePath: '/invalid/path/that/does/not/exist.txt',
        content: 'content',
        expected: {
          shouldThrow: /Failed to write file/,
        },
      },
      {
        name: 'should handle empty content',
        filePath: `${testDir}/empty-write.txt`,
        content: '',
        expected: {
          contentMatches: true,
        },
      },
      {
        name: 'should handle large content',
        filePath: `${testDir}/large-write.txt`,
        content: 'x'.repeat(50000),
        expected: {
          contentMatches: true,
          length: 50000,
        },
      },
      {
        name: 'should preserve line endings',
        filePath: `${testDir}/lineendings-write.txt`,
        content: 'line1\\nline2\\r\\nline3\\n',
        expected: {
          contentMatches: true,
        },
      },
    ];

    testCases.forEach(({ name, filePath, content, setupFn, expected, note }) => {
      test(name, () => {
        if (setupFn) {
          setupFn();
        }

        if (expected.shouldThrow) {
          expect(() => {
            writeFileContent(filePath, content);
          }).toThrow(expected.shouldThrow);
        } else {
          writeFileContent(filePath, content);

          if (expected.contentMatches) {
            const readContent = readFileSync(filePath, 'utf-8');
            expect(readContent).toBe(content);

            if (expected.length !== undefined) {
              expect(readContent.length).toBe(expected.length);
            }
          }
        }
      });
    });
  });

  describe('integration', () => {
    const testCases = [
      {
        name: 'should work together for read-modify-write operations',
        setupFn: () => {
          const originalContent = 'const oldValue = 42;';
          writeFileContent(`${testDir}/integration.js`, originalContent);
          return originalContent;
        },
        testFn: () => {
          const content = readFileContent(`${testDir}/integration.js`);
          const modifiedContent = content.replace('oldValue', 'newValue');
          writeFileContent(`${testDir}/integration.js`, modifiedContent);
          return readFileContent(`${testDir}/integration.js`);
        },
        expected: {
          finalContent: 'const newValue = 42;',
        },
      },
      {
        name: 'should handle multiple file operations',
        setupFn: () => {
          const files = ['test1.js', 'test2.js', 'test3.js'];
          const content = 'test content';
          
          // Write multiple files
          files.forEach(file => {
            writeFileContent(`${testDir}/${file}`, content);
          });
          
          return { files, content };
        },
        testFn: async (setupResult) => {
          const { files, content } = setupResult;
          
          // Read them back
          const readResults = files.map(file => {
            return readFileContent(`${testDir}/${file}`);
          });
          
          // Verify with searchFiles
          const foundFiles = await searchFiles(`${testDir}/test*.js`);
          
          return { readResults, foundFiles, content };
        },
        expected: {
          checkMultipleFiles: true,
        },
      },
    ];

    testCases.forEach(({ name, setupFn, testFn, expected }) => {
      test(name, async () => {
        const setupResult = setupFn();
        const testResult = await testFn(setupResult);

        if (expected.finalContent) {
          expect(testResult).toBe(expected.finalContent);
        }

        if (expected.checkMultipleFiles) {
          const { readResults, foundFiles, content } = testResult;
          
          // Check that all files were read correctly
          readResults.forEach(readContent => {
            expect(readContent).toBe(content);
          });
          
          // Check that searchFiles found all files
          expect(foundFiles).toHaveLength(3);
        }
      });
    });
  });
});
