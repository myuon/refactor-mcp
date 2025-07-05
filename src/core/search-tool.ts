import { existsSync } from 'fs';
import { searchFiles, readFileContent } from '../utils/file-utils.js';
import { groupConsecutiveLines } from '../utils/line-utils.js';

export interface SearchOptions {
  searchPattern: string;
  contextPattern?: string;
  filePattern?: string;
}

export interface SearchMatch {
  line: number;
  content: string;
  captureGroups?: string[];
  matchedText?: string;
}

export interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
  lineNumbers: number[];
  groupedLines: string[];
}

export async function performSearch(
  options: SearchOptions
): Promise<SearchResult[]> {
  const files = await searchFiles(options.filePattern);
  const results: SearchResult[] = [];

  const searchRegex = new RegExp(options.searchPattern, 'gm');
  const contextRegex = options.contextPattern
    ? new RegExp(options.contextPattern, 'gm')
    : null;

  for (const filePath of files) {
    if (!existsSync(filePath)) continue;

    const content = readFileContent(filePath);
    const lines = content.split('\n');

    const matches = [...content.matchAll(searchRegex)];
    const validMatches: SearchMatch[] = [];

    for (const match of matches) {
      if (match.index !== undefined) {
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        // Extract capture groups if any
        const captureGroups = match
          .slice(1)
          .filter(group => group !== undefined);
        // Extract the full matched text
        const matchedText = match[0];

        if (contextRegex) {
          const beforeMatchLines = beforeMatch.split('\n').slice(-5).join('\n');
          const afterMatchIndex = match.index + match[0].length;
          const afterMatch = content.substring(afterMatchIndex);
          const afterMatchLines = afterMatch.split('\n').slice(0, 5).join('\n');
          const contextArea = beforeMatchLines + match[0] + afterMatchLines;

          if (contextRegex.test(contextArea)) {
            validMatches.push({
              line: lineNumber,
              content: lines[lineNumber - 1],
              captureGroups:
                captureGroups.length > 0 ? captureGroups : undefined,
              matchedText,
            });
          }
        } else {
          validMatches.push({
            line: lineNumber,
            content: lines[lineNumber - 1],
            captureGroups: captureGroups.length > 0 ? captureGroups : undefined,
            matchedText,
          });
        }
      }
    }

    if (validMatches.length > 0) {
      const uniqueLineNumbers = [...new Set(validMatches.map(m => m.line))];
      const lineNumbers = uniqueLineNumbers.sort((a, b) => a - b);
      const groupedLines = groupConsecutiveLines(lineNumbers);

      results.push({
        filePath,
        matches: validMatches,
        lineNumbers,
        groupedLines,
      });
    }
  }

  return results;
}

export interface FormatOptions {
  includeCaptureGroups?: boolean;
  includeMatchedText?: boolean;
}

export function formatSearchResults(
  results: SearchResult[],
  options?: FormatOptions
): string {
  if (results.length === 0) {
    return 'No matches found for the given pattern';
  }

  if (options?.includeCaptureGroups || options?.includeMatchedText) {
    return formatDetailedSearchResults(results, options);
  }

  const formattedResults = results.map(
    result => `${result.filePath} (${result.groupedLines.join(', ')})`
  );

  return `Search results:\n${formattedResults.join('\n')}`;
}

function formatDetailedSearchResults(
  results: SearchResult[],
  options: FormatOptions
): string {
  const output: string[] = ['Search results:'];

  for (const result of results) {
    output.push(`\n${result.filePath}:`);

    for (const match of result.matches) {
      if (options.includeMatchedText) {
        output.push(`  Line ${match.line}: ${match.matchedText}`);
      } else {
        output.push(`  Line ${match.line}: ${match.content}`);
      }

      if (
        options.includeCaptureGroups &&
        match.captureGroups &&
        match.captureGroups.length > 0
      ) {
        output.push(`    └─ Captured: [${match.captureGroups.join(', ')}]`);
      }
    }
  }

  return output.join('\n');
}
