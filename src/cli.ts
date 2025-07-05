import { Command } from 'commander';
import { performSearch } from './core/search-tool.js';
import { performRefactor } from './core/refactor-tool.js';
import { readFileContent } from './utils/file-utils.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileContent(join(__dirname, '../package.json'))
);

export async function startCli(args?: string[]) {
  const program = new Command();
  
  program
    .name('refactor-mcp cli')
    .description('CLI tool for code refactoring and searching')
    .version(packageJson.version);

  program
    .command('search')
  .description('Search for code patterns using regex')
  .requiredOption(
    '-p, --pattern <pattern>',
    'Regular expression pattern to search for'
  )
  .option(
    '-c, --context <context>',
    'Optional context pattern to filter matches'
  )
  .option(
    '-f, --files <files>',
    'Optional file glob pattern to limit search scope'
  )
  .option('--print', 'Print matched content to stdout')
  .option('--matched', 'Show matched text and capture groups')
  .action(async options => {
    try {
      const results = await performSearch({
        searchPattern: options.pattern,
        contextPattern: options.context,
        filePattern: options.files,
      });

      if (options.print && results.length > 0) {
        for (const result of results) {
          console.log(`\n=== ${result.filePath} ===`);
          for (const match of result.matches) {
            console.log(`${match.line}:${match.content}`);
            if (match.captureGroups && match.captureGroups.length > 0) {
              console.log(`  └─ Captured: [${match.captureGroups.join(', ')}]`);
            }
          }
        }
      }

      if (options.matched && results.length > 0) {
        for (const result of results) {
          console.log(`\n=== ${result.filePath} ===`);
          for (const match of result.matches) {
            console.log(`${match.line}: ${match.matchedText}`);
            if (match.captureGroups && match.captureGroups.length > 0) {
              console.log(`  └─ Captured: [${match.captureGroups.join(', ')}]`);
            }
          }
        }
      }

      if (results.length > 0) {
        console.log('Search results:');
        results.forEach(result => 
          console.log(`${result.filePath} (${result.groupedLines.join(', ')})`)
        );
      } else {
        console.log('No matches found for the given pattern');
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error during search: ${error}`);
      process.exit(1);
    }
  });

  program
    .command('refactor')
  .description(
    'Refactor code by replacing search pattern with replace pattern using regex'
  )
  .requiredOption(
    '-s, --search <search>',
    'Regular expression pattern to search for'
  )
  .requiredOption(
    '-r, --replace <replace>',
    'Replacement pattern (can use $1, $2, etc. for capture groups)'
  )
  .option(
    '-c, --context <context>',
    'Optional context pattern to filter matches'
  )
  .option(
    '-f, --files <files>',
    'Optional file glob pattern to limit search scope'
  )
  .option(
    '--dry-run',
    'Show what would be changed without actually modifying files'
  )
  .option('--print', 'Print matched content to stdout')
  .action(async options => {
    try {
      const results = await performRefactor({
        searchPattern: options.search,
        replacePattern: options.replace,
        contextPattern: options.context,
        filePattern: options.files,
        dryRun: !!options.dryRun,
      });

      if (options.print && results.length > 0) {
        for (const result of results) {
          console.log(`\n=== ${result.filePath} ===`);
          for (const match of result.matches) {
            console.log(`${match.line}:${match.content}`);
            console.log(`   - ${match.original} → ${match.replaced}`);
            if (match.captureGroups && match.captureGroups.length > 0) {
              console.log(`     └─ Captured: [${match.captureGroups.join(', ')}]`);
            }
          }
        }
      }

      if (results.length > 0) {
        console.log('Refactoring completed:');
        results.forEach(result => 
          console.log(`${result.filePath}: ${result.replacements} replacements${options.dryRun ? ' (dry run)' : ''}`)
        );
        
        const totalReplacements = results.reduce((sum, result) => sum + result.replacements, 0);
        console.log(`\nTotal: ${totalReplacements} replacements in ${results.length} files`);
      } else {
        console.log('No matches found for the given pattern');
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error during refactoring: ${error}`);
      process.exit(1);
    }
  });

  if (args) {
    // Prepend dummy values for 'node' and 'script' to match expected argv format
    await program.parseAsync(['node', 'cli', ...args]);
  } else {
    await program.parseAsync();
  }
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  startCli().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
