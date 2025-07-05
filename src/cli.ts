#!/usr/bin/env node

import { program } from 'commander';
import {
  searchFiles,
  readFileContent,
  writeFileContent,
  groupConsecutiveLines,
} from './server.js';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileContent(join(__dirname, '../package.json'))
);

program
  .name('refactor-mcp')
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
  .action(async options => {
    try {
      const files = await searchFiles(options.files);
      const results: string[] = [];

      const searchRegex = new RegExp(options.pattern, 'gm');
      const contextRegex = options.context
        ? new RegExp(options.context, 'gm')
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
          const uniqueLineNumbers = [...new Set(validMatches.map(m => m.line))];
          const lineNumbers = uniqueLineNumbers.sort((a, b) => a - b);

          const groupedLines = groupConsecutiveLines(lineNumbers);
          results.push(`${filePath} (${groupedLines.join(', ')})`);
        }
      }

      if (results.length > 0) {
        console.log('Search results:');
        results.forEach(result => console.log(result));
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
  .action(async options => {
    try {
      const files = await searchFiles(options.files);
      const results: string[] = [];
      let totalReplacements = 0;

      for (const filePath of files) {
        if (!existsSync(filePath)) continue;

        const content = readFileContent(filePath);
        let modified = false;
        let fileReplacements = 0;

        const searchRegex = new RegExp(options.search, 'g');
        const contextRegex = options.context
          ? new RegExp(options.context, 'g')
          : null;

        let newContent = content;

        if (contextRegex) {
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
                  match[0].replace(new RegExp(options.search), options.replace)
                );
                fileReplacements++;
                modified = true;
              }
            }
          }
        } else {
          const replacedContent = content.replace(searchRegex, options.replace);
          if (replacedContent !== content) {
            newContent = replacedContent;
            fileReplacements = (content.match(searchRegex) || []).length;
            modified = true;
          }
        }

        if (modified) {
          if (options.dryRun) {
            results.push(
              `${filePath}: ${fileReplacements} replacements (dry run)`
            );
          } else {
            writeFileContent(filePath, newContent);
            results.push(`${filePath}: ${fileReplacements} replacements`);
          }
          totalReplacements += fileReplacements;
        }
      }

      if (results.length > 0) {
        console.log('Refactoring completed:');
        results.forEach(result => console.log(result));
        console.log(
          `\nTotal: ${totalReplacements} replacements in ${results.length} files`
        );
      } else {
        console.log('No matches found for the given pattern');
      }
      process.exit(0);
    } catch (error) {
      console.error(`Error during refactoring: ${error}`);
      process.exit(1);
    }
  });

program.parse();
