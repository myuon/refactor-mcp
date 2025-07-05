# refactor-mcp

A Model Context Protocol (MCP) server that provides powerful refactoring tools for Coding Agents. It can run in two modes:

- **MCP Server Mode** (default): Integrates with MCP-compatible clients like Claude Code
- **CLI Mode**: Direct command-line usage for standalone refactoring tasks

## Features

This MCP server implements two main tools to assist with code refactoring:

### 🔧 code_refactor
Performs regex-based search and replace operations across files with advanced filtering capabilities.

**Parameters:**
- `search_pattern` (string) - Regular expression pattern to search for
- `replace_pattern` (string) - Replacement pattern (supports capture groups like $1, $2)
- `context_pattern` (string, optional) - Only replace matches within this context
- `file_pattern` (string, optional) - Glob pattern to limit files (e.g., `*.js`, `src/**/*.ts`)

**Example:**
```javascript
// Replace foo() calls with bar() calls
code_refactor("foo\\((.+)\\)", "bar($1)")

// Before: let k = foo(1,2,3);
// After:  let k = bar(1,2,3);
```

**Context-aware refactoring:**
```javascript
// Only replace "legacy_sdk" within import statements
code_refactor("legacy_sdk", "brand_new_sdk", "import")
```

### 🔍 code_search
Searches for regex patterns and returns file locations with precise line numbers.

**Parameters:**
- `search_pattern` (string) - Regular expression pattern to search for
- `context_pattern` (string, optional) - Filter matches by surrounding context
- `file_pattern` (string, optional) - Glob pattern to limit search scope

**Example:**
```javascript
code_search("foo\\(.+\\)")

// Result:
// ./src/utils.js (line: 15)
// ./src/helpers.ts (lines: 23-27)
```

## Installation

### Quick Start

**MCP Server Mode** (for Claude Code and other MCP clients):
```bash
# Install globally for MCP integration
npm install -g @myuon/refactor-mcp

# Or use with npx (recommended for MCP clients)
npx @myuon/refactor-mcp@latest
```

**CLI Mode** (for direct command-line usage):
```bash
# Search for patterns
npx @myuon/refactor-mcp@latest cli search -p "function.*\(" -f "src/**/*.js"

# Refactor with preview
npx @myuon/refactor-mcp@latest cli refactor -s "const (\w+)" -r "let \$1" --dry-run
```

### For Development
```bash
# Clone and install dependencies
git clone https://github.com/myuon/refactor-mcp.git
cd refactor-mcp
npm install
```

## Usage

### CLI Mode
You can use the refactor tools directly from the command line by adding `cli` after the main command:

```bash
# Search for patterns
refactor-mcp cli search -p "function (.*) \{" -f "src/**/*.ts"

# Search with matched content display
refactor-mcp cli search -p "function (.*) \{" -f "src/**/*.ts" --print

# Refactor with dry-run (preview changes)
refactor-mcp cli refactor -s "const (\w+) = " -r "let \$1 = " --dry-run

# Refactor with matched content display
refactor-mcp cli refactor -s "const (\w+) = " -r "let \$1 = " --print --dry-run

# Refactor with file pattern
refactor-mcp cli refactor -s "old_function" -r "new_function" -f "src/**/*.js"

# Context-aware refactoring
refactor-mcp cli refactor -s "legacy_sdk" -r "new_sdk" -c "import" -f "src/**/*.ts"
```

**CLI Commands:**
- `search` - Search for code patterns
  - `-p, --pattern <pattern>` - Regular expression pattern to search for
  - `-c, --context <context>` - Optional context pattern to filter matches
  - `-f, --files <files>` - Optional file glob pattern to limit search scope
  - `--print` - Print matched content to stdout
  - `--matched` - Show only matched text with capture groups
- `refactor` - Refactor code with regex replacement
  - `-s, --search <search>` - Regular expression pattern to search for
  - `-r, --replace <replace>` - Replacement pattern (supports $1, $2, etc.)
  - `-c, --context <context>` - Optional context pattern to filter matches
  - `-f, --files <files>` - Optional file glob pattern to limit search scope
  - `--dry-run` - Preview changes without modifying files
  - `--print` - Print matched content and replacements to stdout

**Important Notes:**
- When using capture groups in replacement patterns on the command line, escape the dollar sign: `\$1`, `\$2`, etc.
- Example: `refactor-mcp cli refactor -s "const (\w+) = " -r "let \$1 = " --dry-run`
- This prevents the shell from interpreting `$1` as a shell variable

### MCP Server Mode (Default)
By default, `refactor-mcp` runs as an MCP server via stdio transport:

```bash
# Run as MCP server (default mode)
refactor-mcp

# Or explicitly with npx
npx @myuon/refactor-mcp@latest
```

### Development
```bash
npm run dev          # Run server in development mode
npm run dev:cli      # Run CLI in development mode with arguments
npm run cli          # Run CLI directly (for testing)
npm run build        # Build for production
npm start            # Run built server (MCP mode)
```

### Code Quality
```bash
npm run check        # Run all quality checks
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm test             # Run tests
```

## MCP Integration

This server uses the Model Context Protocol to communicate with compatible clients. It runs via stdio transport and can be integrated into any MCP-compatible environment.

### Claude Code Integration
For Claude Code users, you can easily add this MCP server with:

```bash
claude mcp add refactor npx @myuon/refactor-mcp@latest
```

### Manual Configuration
Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "refactor-mcp": {
      "command": "npx",
      "args": ["@myuon/refactor-mcp@latest"]
    }
  }
}
```

### Alternative Configuration (Local Installation)
```json
{
  "mcpServers": {
    "refactor-mcp": {
      "command": "refactor-mcp"
    }
  }
}
```

## Architecture

- **Framework**: Model Context Protocol SDK for TypeScript
- **Runtime**: Node.js with ES modules
- **Validation**: Zod schemas for type-safe input validation
- **File Operations**: Native fs module with glob pattern matching
- **Testing**: Vitest with comprehensive test coverage

## Contributing

1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Check code quality: `npm run check`
4. Build: `npm run build`

## License

MIT