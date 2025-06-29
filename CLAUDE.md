# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides refactoring tools for Coding Agents. The server implements two main tools:

1. **code_refactor** - Performs regex-based search and replace operations on files
2. **code_search** - Searches for regex patterns and returns file locations with line numbers

Both tools support optional filtering via `context_pattern` (contextual matching) and `file_pattern` (glob-based file filtering).

## Development Commands

### Essential Commands
```bash
npm run check           # Run all quality checks (type-check, lint, format, test)
npm run dev            # Run server in development mode with tsx
npm run build          # Compile TypeScript to dist/
npm start              # Run compiled server
```

### Quality Assurance
```bash
npm run type-check     # TypeScript type checking only
npm run lint           # ESLint on src/ and tests/
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without changes
```

### Testing
```bash
npm test               # Run tests in watch mode
npm run test:run       # Run tests once
npm run test:ui        # Open Vitest UI in browser
npm run test:coverage  # Run tests with coverage report
```

## Architecture

### Core Structure
- **src/server.ts** - Main MCP server implementation with two tools
- **tests/server.test.ts** - Comprehensive test suite (14 tests covering all functionality)
- **docs/spec** - Japanese specification defining tool behavior and examples

### MCP Server Implementation
The server uses the `@modelcontextprotocol/sdk` and implements:
- `McpServer` with `StdioServerTransport` for command-line communication
- Zod schemas for input validation
- Helper functions (`searchFiles`, `readFileContent`, `writeFileContent`) exported for testing

### Tool Implementations
Both tools use a common pattern:
1. File discovery via glob patterns (with exclusions for node_modules, dist, .git)
2. Regex matching with optional context filtering
3. Error handling with user-friendly messages
4. Structured output format

### Testing Strategy
- Unit tests for helper functions
- Integration tests for tool behavior
- Spec compliance tests using exact examples from docs/spec
- File system operations with proper cleanup in beforeEach/afterEach

## Code Quality Setup

- **ESLint**: TypeScript rules with relaxed test file rules
- **Prettier**: Consistent formatting across src/ and tests/
- **TypeScript**: Strict mode with ES2022 modules
- **Vitest**: Modern testing with UI support

## Key Implementation Details

The `code_refactor` tool performs context-aware replacements by:
1. Finding matches with the search regex
2. If `context_pattern` is provided, checking surrounding lines (±5 lines)
3. Only replacing matches where context pattern is found
4. Supporting capture groups in replacement patterns ($1, $2, etc.)

The `code_search` tool returns results in the format:
- Single match: `file.js (line: 5)`
- Multiple matches: `file.js (lines: 5-10)`