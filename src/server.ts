#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { performSearch, formatSearchResults } from './core/search-tool.js';
import { performRefactor, formatRefactorResults } from './core/refactor-tool.js';

// Re-export for backward compatibility
export { searchFiles, readFileContent, writeFileContent } from './utils/file-utils.js';
export { groupConsecutiveLines } from './utils/line-utils.js';

const server = new McpServer({
  name: 'refactor-mcp',
  version: '1.0.0',
});


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
      const results = await performRefactor({
        searchPattern: search_pattern,
        replacePattern: replace_pattern,
        contextPattern: context_pattern,
        filePattern: file_pattern,
        dryRun: false,
      });

      const summary = formatRefactorResults(results);

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
      const results = await performSearch({
        searchPattern: search_pattern,
        contextPattern: context_pattern,
        filePattern: file_pattern,
      });

      const summary = formatSearchResults(results);

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
