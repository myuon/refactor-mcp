import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { glob } from 'glob';

export async function searchFiles(filePattern?: string): Promise<string[]> {
  if (!filePattern) {
    return await glob('**/*', {
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
      nodir: true,
    });
  }

  let pattern = filePattern;

  if (
    !pattern.includes('*') &&
    !pattern.includes('?') &&
    !pattern.includes('[')
  ) {
    try {
      if (existsSync(pattern) && statSync(pattern).isDirectory()) {
        pattern = pattern.endsWith('/') ? `${pattern}**` : `${pattern}/**`;
      }
    } catch {
      // If stat fails, use the pattern as-is
    }
  }

  return await glob(pattern, {
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
    nodir: true,
  });
}

export function readFileContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

export function writeFileContent(filePath: string, content: string): void {
  try {
    writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
}
