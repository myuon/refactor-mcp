#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';

const server = new McpServer({
  name: 'refactor-mcp',
  version: '1.0.0',
});

// Helper function to search files based on pattern
export async function searchFiles(filePattern?: string): Promise<string[]> {
  if (!filePattern) {
    // Default to all files in current directory and subdirectories
    return await glob('**/*', {
      ignore: ['node_modules/**', 'dist/**', '.git/**'],
      nodir: true,
    });
  }
  return await glob(filePattern, {
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
    nodir: true,
  });
}

// Helper function to read file content safely
export function readFileContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

// Helper function to write file content safely
export function writeFileContent(filePath: string, content: string): void {
  try {
    writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error}`);
  }
}

server.registerTool(
  'code_refactor',
  {
    title: 'Code Refactor',
    description:
      'Refactor code by replacing search pattern with replace pattern using regex',
    inputSchema: {
      search_pattern: z
        .string()
        .describe('Regular expression pattern to search for'),
      replace_pattern: z
        .string()
        .describe(
          'Replacement pattern (can use $1, $2, etc. for capture groups)'
        ),
      context_pattern: z
        .string()
        .optional()
        .describe('Optional context pattern to filter matches'),
      file_pattern: z
        .string()
        .optional()
        .describe('Optional file glob pattern to limit search scope'),
    },
  },
  async ({
    search_pattern,
    replace_pattern,
    context_pattern,
    file_pattern,
  }) => {
    try {
      const files = await searchFiles(file_pattern);
      const results: string[] = [];
      let totalReplacements = 0;

      for (const filePath of files) {
        if (!existsSync(filePath)) continue;

        const content = readFileContent(filePath);
        let modified = false;
        let fileReplacements = 0;

        const searchRegex = new RegExp(search_pattern, 'g');
        const contextRegex = context_pattern
          ? new RegExp(context_pattern, 'g')
          : null;

        let newContent = content;

        if (contextRegex) {
          // Apply context filtering
          const matches = [...content.matchAll(searchRegex)];
          for (const match of matches) {
            if (match.index !== undefined) {
              const beforeMatch = content.substring(0, match.index);
              const afterMatch = content.substring(
                match.index + match[0].length
              );
              const contextBefore = beforeMatch
                .split('\n')
                .slice(-5)
                .join('\n');
              const contextAfter = afterMatch
                .split('\n')
                .slice(0, 5)
                .join('\n');
              const contextArea = contextBefore + match[0] + contextAfter;

              if (contextRegex.test(contextArea)) {
                newContent = newContent.replace(
                  match[0],
                  match[0].replace(new RegExp(search_pattern), replace_pattern)
                );
                fileReplacements++;
                modified = true;
              }
            }
          }
        } else {
          // Simple replacement without context
          const replacedContent = content.replace(searchRegex, replace_pattern);
          if (replacedContent !== content) {
            newContent = replacedContent;
            fileReplacements = (content.match(searchRegex) || []).length;
            modified = true;
          }
        }

        if (modified) {
          writeFileContent(filePath, newContent);
          results.push(`${filePath}: ${fileReplacements} replacements`);
          totalReplacements += fileReplacements;
        }
      }

      const summary =
        results.length > 0
          ? `Refactoring completed:\n${results.join('\n')}\n\nTotal: ${totalReplacements} replacements in ${results.length} files`
          : 'No matches found for the given pattern';

      return {
        content: [{ type: 'text', text: summary }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error during refactoring: ${error}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'code_search',
  {
    title: 'Code Search',
    description:
      'Search for code patterns using regex and return file locations with line numbers',
    inputSchema: {
      search_pattern: z
        .string()
        .describe('Regular expression pattern to search for'),
      context_pattern: z
        .string()
        .optional()
        .describe('Optional context pattern to filter matches'),
      file_pattern: z
        .string()
        .optional()
        .describe('Optional file glob pattern to limit search scope'),
    },
  },
  async ({ search_pattern, context_pattern, file_pattern }) => {
    try {
      const files = await searchFiles(file_pattern);
      const results: string[] = [];

      const searchRegex = new RegExp(search_pattern, 'gm');
      const contextRegex = context_pattern
        ? new RegExp(context_pattern, 'gm')
        : null;

      for (const filePath of files) {
        if (!existsSync(filePath)) continue;

        const content = readFileContent(filePath);
        const lines = content.split('\n');

        const matches = [...content.matchAll(searchRegex)];
        const validMatches: { line: number; content: string }[] = [];

        for (const match of matches) {
          if (match.index !== undefined) {
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;

            if (contextRegex) {
              const beforeMatchLines = beforeMatch
                .split('\n')
                .slice(-5)
                .join('\n');
              const afterMatchIndex = match.index + match[0].length;
              const afterMatch = content.substring(afterMatchIndex);
              const afterMatchLines = afterMatch
                .split('\n')
                .slice(0, 5)
                .join('\n');
              const contextArea = beforeMatchLines + match[0] + afterMatchLines;

              if (contextRegex.test(contextArea)) {
                validMatches.push({
                  line: lineNumber,
                  content: lines[lineNumber - 1],
                });
              }
            } else {
              validMatches.push({
                line: lineNumber,
                content: lines[lineNumber - 1],
              });
            }
          }
        }

        if (validMatches.length > 0) {
          const lineRanges = validMatches
            .map(m => m.line)
            .sort((a, b) => a - b);
          const firstLine = lineRanges[0];
          const lastLine = lineRanges[lineRanges.length - 1];

          if (firstLine === lastLine) {
            results.push(`${filePath} (line: ${firstLine})`);
          } else {
            results.push(`${filePath} (lines: ${firstLine}-${lastLine})`);
          }
        }
      }

      const summary =
        results.length > 0
          ? `Search results:\n${results.join('\n')}`
          : 'No matches found for the given pattern';

      return {
        content: [{ type: 'text', text: summary }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error during search: ${error}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
