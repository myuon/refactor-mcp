# refactor-mcp

A Model Context Protocol (MCP) server that provides powerful refactoring tools for Coding Agents.

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
```bash
# Install globally
npm install -g @myuon/refactor-mcp

# Or run directly with npx
npx @myuon/refactor-mcp@latest
```

### For Development
```bash
# Clone and install dependencies
git clone https://github.com/myuon/refactor-mcp.git
cd refactor-mcp
npm install
```

## Usage

### Development
```bash
npm run dev          # Run server in development mode
npm run build        # Build for production
npm start            # Run built server
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