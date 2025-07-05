import { existsSync } from 'fs';
import {
  searchFiles,
  readFileContent,
  writeFileContent,
} from '../utils/file-utils.js';

export interface RefactorOptions {
  searchPattern: string;
  replacePattern: string;
  contextPattern?: string;
  filePattern?: string;
  dryRun?: boolean;
}

export interface RefactorMatch {
  line: number;
  content: string;
  original: string;
  replaced: string;
  captureGroups?: string[];
}

export interface RefactorResult {
  filePath: string;
  replacements: number;
  matches: RefactorMatch[];
  modified: boolean;
}

export async function performRefactor(
  options: RefactorOptions
): Promise<RefactorResult[]> {
  const files = await searchFiles(options.filePattern);
  const results: RefactorResult[] = [];

  for (const filePath of files) {
    if (!existsSync(filePath)) continue;

    const content = readFileContent(filePath);
    const lines = content.split('\n');
    let modified = false;
    let fileReplacements = 0;
    const matchedLines: RefactorMatch[] = [];

    const searchRegex = new RegExp(options.searchPattern, 'g');
    const contextRegex = options.contextPattern
      ? new RegExp(options.contextPattern, 'g')
      : null;

    let newContent = content;

    if (contextRegex) {
      const matches = [...content.matchAll(searchRegex)];
      for (const match of matches) {
        if (match.index !== undefined) {
          const beforeMatch = content.substring(0, match.index);
          const afterMatch = content.substring(match.index + match[0].length);
          const contextBefore = beforeMatch.split('\n').slice(-5).join('\n');
          const contextAfter = afterMatch.split('\n').slice(0, 5).join('\n');
          const contextArea = contextBefore + match[0] + contextAfter;

          if (contextRegex.test(contextArea)) {
            const lineNumber = beforeMatch.split('\n').length;
            const originalLine = lines[lineNumber - 1];

            matchedLines.push({
              line: lineNumber,
              content: originalLine,
              original: match[0],
              replaced: match[0].replace(
                new RegExp(options.searchPattern),
                options.replacePattern
              ),
            });

            newContent = newContent.replace(
              match[0],
              match[0].replace(
                new RegExp(options.searchPattern),
                options.replacePattern
              )
            );
            fileReplacements++;
            modified = true;
          }
        }
      }
    } else {
      const matches = [...content.matchAll(searchRegex)];
      for (const match of matches) {
        if (match.index !== undefined) {
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;
          const originalLine = lines[lineNumber - 1];

          matchedLines.push({
            line: lineNumber,
            content: originalLine,
            original: match[0],
            replaced: match[0].replace(
              new RegExp(options.searchPattern),
              options.replacePattern
            ),
          });
        }
      }

      const replacedContent = content.replace(
        searchRegex,
        options.replacePattern
      );
      if (replacedContent !== content) {
        newContent = replacedContent;
        fileReplacements = (content.match(searchRegex) || []).length;
        modified = true;
      }
    }

    if (modified) {
      if (!options.dryRun) {
        writeFileContent(filePath, newContent);
      }

      results.push({
        filePath,
        replacements: fileReplacements,
        matches: matchedLines,
        modified: true,
      });
    }
  }

  return results;
}

export interface RefactorFormatOptions {
  includeCaptureGroups?: boolean;
  includeMatchedText?: boolean;
  dryRun?: boolean;
}

export function formatRefactorResults(
  results: RefactorResult[],
  options?: RefactorFormatOptions | boolean
): string {
  // Handle backward compatibility - if boolean is passed, treat as dryRun
  const formatOptions: RefactorFormatOptions = typeof options === 'boolean' 
    ? { dryRun: options }
    : options || {};
  if (results.length === 0) {
    return 'No matches found for the given pattern';
  }

  if (formatOptions.includeCaptureGroups || formatOptions.includeMatchedText) {
    return formatDetailedRefactorResults(results, formatOptions);
  }

  const formattedResults = results.map(
    result =>
      `${result.filePath}: ${result.replacements} replacements${formatOptions.dryRun ? ' (dry run)' : ''}`
  );

  const totalReplacements = results.reduce(
    (sum, result) => sum + result.replacements,
    0
  );

  return `Refactoring completed:\n${formattedResults.join('\n')}\n\nTotal: ${totalReplacements} replacements in ${results.length} files`;
}

function formatDetailedRefactorResults(results: RefactorResult[], options: RefactorFormatOptions): string {
  const output: string[] = [`Refactoring completed${options.dryRun ? ' (dry run)' : ''}:`];
  
  for (const result of results) {
    output.push(`\n${result.filePath}: ${result.replacements} replacements`);
    
    for (const match of result.matches) {
      if (options.includeMatchedText) {
        output.push(`  Line ${match.line}: ${match.original} → ${match.replaced}`);
      } else {
        output.push(`  Line ${match.line}: ${match.content}`);
      }
      
      if (options.includeCaptureGroups && match.captureGroups && match.captureGroups.length > 0) {
        output.push(`    └─ Captured: [${match.captureGroups.join(', ')}]`);
      }
    }
  }

  const totalReplacements = results.reduce((sum, result) => sum + result.replacements, 0);
  output.push(`\nTotal: ${totalReplacements} replacements in ${results.length} files${options.dryRun ? ' (dry run)' : ''}`);
  
  return output.join('\n');
}
