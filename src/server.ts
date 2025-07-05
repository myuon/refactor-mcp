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

// Register prompt resources for common code extraction patterns
server.registerPrompt(
  'extract-functions',
  {
    title: 'Extract Functions',
    description: 'Extract all function names from specified directory or files',
    argsSchema: {
      directory: z
        .string()
        .describe('Directory or file pattern to search (e.g., src/**/*.js)'),
      pattern_type: z
        .string()
        .optional()
        .describe('Type of functions to extract (function, arrow, class_method, all)'),
    },
  },
  async ({ directory, pattern_type = 'all' }) => {
    let searchPattern: string;
    let description: string;

    switch (pattern_type) {
      case 'function':
        searchPattern = '(?:function\\s+|export\\s+function\\s+)(\\w+)\\s*\\(';
        description = 'Regular function declarations';
        break;
      case 'arrow':
        searchPattern = '(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:\\([^)]*\\)\\s*=>|\\w+\\s*=>)';
        description = 'Arrow function assignments';
        break;
      case 'class_method':
        searchPattern = '(?:public\\s+|private\\s+|protected\\s+|static\\s+)?(\\w+)\\s*\\([^)]*\\)\\s*\\{';
        description = 'Class methods';
        break;
      default:
        searchPattern = '(?:function\\s+|export\\s+function\\s+)(\\w+)\\s*\\(|(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:\\([^)]*\\)\\s*=>|\\w+\\s*=>)|(?:public\\s+|private\\s+|protected\\s+|static\\s+)?(\\w+)\\s*\\([^)]*\\)\\s*\\{';
        description = 'All function types (declarations, arrows, methods)';
        break;
    }

    const prompt = `Use the code_search tool to extract ${description} from ${directory}:

\`\`\`
{
  "search_pattern": "${searchPattern}",
  "file_pattern": "${directory}",
  "include_capture_groups": true,
  "include_matched_text": true
}
\`\`\`

This will find all function names and show:
- The exact matched text
- Captured function names in brackets

Pattern explanation:
- ${description}
- Captures function names in groups for easy extraction
- Shows both the full match and just the function names

Example usage:
1. Run the code_search tool with the above parameters
2. Extract function names from the "Captured" sections
3. Use the results for documentation, refactoring, or analysis`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'extract-classes',
  {
    title: 'Extract Classes',
    description: 'Extract all class names from specified directory or files',
    argsSchema: {
      directory: z
        .string()
        .describe('Directory or file pattern to search (e.g., src/**/*.ts)'),
      include_interfaces: z
        .string()
        .optional()
        .describe('Include TypeScript interfaces (true/false)'),
    },
  },
  async ({ directory, include_interfaces = 'false' }) => {
    const includeInterfaces = include_interfaces === 'true';
    
    let searchPattern: string;
    let description: string;

    if (includeInterfaces) {
      searchPattern = '(?:export\\s+)?(?:class|interface)\\s+(\\w+)';
      description = 'classes and interfaces';
    } else {
      searchPattern = '(?:export\\s+)?class\\s+(\\w+)';
      description = 'classes';
    }

    const prompt = `Use the code_search tool to extract all ${description} from ${directory}:

\`\`\`
{
  "search_pattern": "${searchPattern}",
  "file_pattern": "${directory}",
  "include_capture_groups": true,
  "include_matched_text": true
}
\`\`\`

This will find all ${description} and show:
- The exact matched text (class/interface declarations)
- Captured ${description} names in brackets

Pattern explanation:
- Matches both exported and non-exported ${description}
- Captures ${description} names for easy extraction
- Works with TypeScript and JavaScript files

Example usage:
1. Run the code_search tool with the above parameters
2. Extract ${description} names from the "Captured" sections
3. Use for architecture analysis or refactoring planning`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'extract-variables',
  {
    title: 'Extract Variables',
    description: 'Extract variable declarations from specified directory or files',
    argsSchema: {
      directory: z
        .string()
        .describe('Directory or file pattern to search (e.g., src/**/*.js)'),
      declaration_type: z
        .string()
        .optional()
        .describe('Type of declarations (const, let, var, all)'),
    },
  },
  async ({ directory, declaration_type = 'all' }) => {
    let searchPattern: string;
    let description: string;

    switch (declaration_type) {
      case 'const':
        searchPattern = 'const\\s+(\\w+)\\s*=';
        description = 'const declarations';
        break;
      case 'let':
        searchPattern = 'let\\s+(\\w+)\\s*=';
        description = 'let declarations';
        break;
      case 'var':
        searchPattern = 'var\\s+(\\w+)\\s*=';
        description = 'var declarations';
        break;
      default:
        searchPattern = '(?:const|let|var)\\s+(\\w+)\\s*=';
        description = 'all variable declarations';
        break;
    }

    const prompt = `Use the code_search tool to extract ${description} from ${directory}:

\`\`\`
{
  "search_pattern": "${searchPattern}",
  "file_pattern": "${directory}",
  "include_capture_groups": true,
  "include_matched_text": true
}
\`\`\`

This will find all ${description} and show:
- The exact matched text (variable declarations)
- Captured variable names in brackets

Pattern explanation:
- Matches ${description}
- Captures variable names for easy extraction
- Useful for analyzing code structure and dependencies

Example usage:
1. Run the code_search tool with the above parameters
2. Extract variable names from the "Captured" sections
3. Use for refactoring or dependency analysis`;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
    };
  }
);


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
      include_capture_groups: z
        .boolean()
        .optional()
        .describe('Include capture groups in the results'),
      include_matched_text: z
        .boolean()
        .optional()
        .describe('Include matched text in the results'),
    },
  },
  async ({
    search_pattern,
    replace_pattern,
    context_pattern,
    file_pattern,
    include_capture_groups,
    include_matched_text,
  }) => {
    try {
      const results = await performRefactor({
        searchPattern: search_pattern,
        replacePattern: replace_pattern,
        contextPattern: context_pattern,
        filePattern: file_pattern,
        dryRun: false,
      });

      const summary = formatRefactorResults(results, {
        includeCaptureGroups: include_capture_groups,
        includeMatchedText: include_matched_text,
        dryRun: false,
      });

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
      include_capture_groups: z
        .boolean()
        .optional()
        .describe('Include capture groups in the results'),
      include_matched_text: z
        .boolean()
        .optional()
        .describe('Include matched text in the results'),
    },
  },
  async ({ search_pattern, context_pattern, file_pattern, include_capture_groups, include_matched_text }) => {
    try {
      const results = await performSearch({
        searchPattern: search_pattern,
        contextPattern: context_pattern,
        filePattern: file_pattern,
      });

      const summary = formatSearchResults(results, {
        includeCaptureGroups: include_capture_groups,
        includeMatchedText: include_matched_text,
      });

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

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
