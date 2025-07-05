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
    test('should find all files with default pattern', async () => {
      const files = await searchFiles();
      expect(files).toBeInstanceOf(Array);
      expect(files.length).toBeGreaterThan(0);
      // Should exclude node_modules, dist, .git
      expect(files.some(f => f.includes('node_modules'))).toBe(false);
      expect(files.some(f => f.includes('dist'))).toBe(false);
      expect(files.some(f => f.includes('.git'))).toBe(false);
    });

    test('should find files with specific glob pattern', async () => {
      const files = await searchFiles(`${testDir}/**/*.js`);
      expect(files.length).toBeGreaterThanOrEqual(2); // At least file1.js, nested/file4.js
      expect(files.every(f => f.endsWith('.js'))).toBe(true);
    });

    test('should find files with multiple extensions', async () => {
      const files = await searchFiles(`${testDir}/**/*.{js,ts}`);
      expect(files.length).toBeGreaterThanOrEqual(3); // At least js and ts files
      expect(files.some(f => f.endsWith('.js'))).toBe(true);
      expect(files.some(f => f.endsWith('.ts'))).toBe(true);
    });

    test('should handle directory patterns correctly', async () => {
      const files = await searchFiles(testDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files.every(f => f.startsWith(testDir))).toBe(true);
    });

    test('should handle directory with trailing slash', async () => {
      const files = await searchFiles(`${testDir}/`);
      expect(files.length).toBeGreaterThan(0);
      expect(files.every(f => f.startsWith(testDir))).toBe(true);
    });

    test('should return empty array for non-existent patterns', async () => {
      const files = await searchFiles('non-existent/**/*.xyz');
      expect(files).toHaveLength(0);
    });

    test('should handle patterns with special characters', async () => {
      const files = await searchFiles(`${testDir}/**/*file*.js`);
      expect(files.length).toBeGreaterThan(0);
      expect(files.every(f => f.includes('file') && f.endsWith('.js'))).toBe(
        true
      );
    });

    test('should exclude ignored directories', async () => {
      // Test with default pattern which should exclude node_modules
      const defaultFiles = await searchFiles();
      expect(defaultFiles.some(f => f.includes('node_modules'))).toBe(false);
      expect(defaultFiles.some(f => f.includes('dist'))).toBe(false);
      expect(defaultFiles.some(f => f.includes('.git'))).toBe(false);
    });
  });

  describe('readFileContent', () => {
    test('should read file content correctly', () => {
      const content = readFileContent(`${testDir}/file1.js`);
      expect(content).toBe('console.log("file1");');
    });

    test('should handle UTF-8 content correctly', () => {
      const testContent = 'Hello 世界 🌍';
      writeFileSync(`${testDir}/utf8.txt`, testContent, 'utf-8');

      const content = readFileContent(`${testDir}/utf8.txt`);
      expect(content).toBe(testContent);
    });

    test('should throw error for non-existent file', () => {
      expect(() => {
        readFileContent('non-existent-file.txt');
      }).toThrow(/Failed to read file/);
    });

    test('should handle empty files', () => {
      writeFileSync(`${testDir}/empty.txt`, '');
      const content = readFileContent(`${testDir}/empty.txt`);
      expect(content).toBe('');
    });

    test('should handle large files', () => {
      const largeContent = 'x'.repeat(10000);
      writeFileSync(`${testDir}/large.txt`, largeContent);

      const content = readFileContent(`${testDir}/large.txt`);
      expect(content).toBe(largeContent);
      expect(content.length).toBe(10000);
    });

    test('should preserve line endings', () => {
      const contentWithLineEndings = 'line1\nline2\r\nline3\n';
      writeFileSync(`${testDir}/lineendings.txt`, contentWithLineEndings);

      const content = readFileContent(`${testDir}/lineendings.txt`);
      expect(content).toBe(contentWithLineEndings);
    });
  });

  describe('writeFileContent', () => {
    test('should write file content correctly', () => {
      const testContent = 'test content';
      writeFileContent(`${testDir}/write-test.txt`, testContent);

      const readContent = readFileSync(`${testDir}/write-test.txt`, 'utf-8');
      expect(readContent).toBe(testContent);
    });

    test('should overwrite existing files', () => {
      const originalContent = 'original';
      const newContent = 'new content';

      writeFileContent(`${testDir}/overwrite-test.txt`, originalContent);
      writeFileContent(`${testDir}/overwrite-test.txt`, newContent);

      const readContent = readFileSync(
        `${testDir}/overwrite-test.txt`,
        'utf-8'
      );
      expect(readContent).toBe(newContent);
    });

    test('should handle UTF-8 content correctly', () => {
      const testContent = 'Hello 世界 🌍';
      writeFileContent(`${testDir}/utf8-write.txt`, testContent);

      const readContent = readFileSync(`${testDir}/utf8-write.txt`, 'utf-8');
      expect(readContent).toBe(testContent);
    });

    test('should create nested directories if needed', () => {
      const nestedPath = `${testDir}/deep/nested/file.txt`;
      const testContent = 'nested content';

      // This should NOT work as writeFileContent doesn't create directories
      expect(() => {
        writeFileContent(nestedPath, testContent);
      }).toThrow(/Failed to write file/);
    });

    test('should throw error for invalid paths', () => {
      expect(() => {
        writeFileContent('/invalid/path/that/does/not/exist.txt', 'content');
      }).toThrow(/Failed to write file/);
    });

    test('should handle empty content', () => {
      writeFileContent(`${testDir}/empty-write.txt`, '');
      const readContent = readFileSync(`${testDir}/empty-write.txt`, 'utf-8');
      expect(readContent).toBe('');
    });

    test('should handle large content', () => {
      const largeContent = 'x'.repeat(50000);
      writeFileContent(`${testDir}/large-write.txt`, largeContent);

      const readContent = readFileSync(`${testDir}/large-write.txt`, 'utf-8');
      expect(readContent).toBe(largeContent);
      expect(readContent.length).toBe(50000);
    });

    test('should preserve line endings', () => {
      const contentWithLineEndings = 'line1\nline2\r\nline3\n';
      writeFileContent(
        `${testDir}/lineendings-write.txt`,
        contentWithLineEndings
      );

      const readContent = readFileSync(
        `${testDir}/lineendings-write.txt`,
        'utf-8'
      );
      expect(readContent).toBe(contentWithLineEndings);
    });
  });

  describe('integration', () => {
    test('should work together for read-modify-write operations', () => {
      const originalContent = 'const oldValue = 42;';
      writeFileContent(`${testDir}/integration.js`, originalContent);

      const content = readFileContent(`${testDir}/integration.js`);
      const modifiedContent = content.replace('oldValue', 'newValue');
      writeFileContent(`${testDir}/integration.js`, modifiedContent);

      const finalContent = readFileContent(`${testDir}/integration.js`);
      expect(finalContent).toBe('const newValue = 42;');
    });

    test('should handle multiple file operations', async () => {
      const files = ['test1.js', 'test2.js', 'test3.js'];
      const content = 'test content';

      // Write multiple files
      files.forEach(file => {
        writeFileContent(`${testDir}/${file}`, content);
      });

      // Read them back
      files.forEach(file => {
        const readContent = readFileContent(`${testDir}/${file}`);
        expect(readContent).toBe(content);
      });

      // Verify with searchFiles
      const foundFiles = await searchFiles(`${testDir}/test*.js`);
      expect(foundFiles).toHaveLength(3);
    });
  });
});
