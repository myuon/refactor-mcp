import { describe, test, expect } from 'vitest';
import { groupConsecutiveLines } from '../../src/utils/line-utils.js';

describe('Line Utils', () => {
  describe('groupConsecutiveLines', () => {
    const testCases = [
      {
        name: 'should handle empty array',
        input: [],
        expected: [],
      },
      {
        name: 'should handle single line number',
        input: [5],
        expected: ['line: 5'],
      },
      {
        name: 'should handle two consecutive line numbers',
        input: [1, 2],
        expected: ['lines: 1-2'],
      },
      {
        name: 'should handle multiple consecutive line numbers',
        input: [1, 2, 3, 4, 5],
        expected: ['lines: 1-5'],
      },
      {
        name: 'should handle non-consecutive line numbers',
        input: [1, 3, 5],
        expected: ['line: 1', 'line: 3', 'line: 5'],
      },
      {
        name: 'should handle mixed consecutive and non-consecutive line numbers',
        input: [1, 2, 3, 5, 7, 8, 10],
        expected: ['lines: 1-3', 'line: 5', 'lines: 7-8', 'line: 10'],
      },
      {
        name: 'should handle consecutive pairs',
        input: [1, 2, 4, 5, 7, 8],
        expected: ['lines: 1-2', 'lines: 4-5', 'lines: 7-8'],
      },
      {
        name: 'should handle large consecutive range',
        input: Array.from({ length: 100 }, (_, i) => i + 1),
        expected: ['lines: 1-100'],
      },
      {
        name: 'should handle unsorted input correctly',
        input: [3, 1, 2, 5, 4],
        expected: ['line: 3', 'lines: 1-2', 'line: 5', 'line: 4'],
        note: 'Function processes in order without sorting',
      },
      {
        name: 'should handle duplicate line numbers',
        input: [1, 1, 2, 2, 3],
        expected: ['line: 1', 'lines: 1-2', 'lines: 2-3'],
        note: 'Function processes duplicates as separate items',
      },
      {
        name: 'should handle gaps of different sizes',
        input: [1, 2, 5, 6, 7, 10, 15, 16],
        expected: ['lines: 1-2', 'lines: 5-7', 'line: 10', 'lines: 15-16'],
      },
      {
        name: 'should handle single lines between consecutive groups',
        input: [1, 2, 4, 6, 7, 8],
        expected: ['lines: 1-2', 'line: 4', 'lines: 6-8'],
      },
      {
        name: 'should handle alternating consecutive and single lines',
        input: [1, 3, 4, 6, 8, 9, 10, 12],
        expected: ['line: 1', 'lines: 3-4', 'line: 6', 'lines: 8-10', 'line: 12'],
      },
      {
        name: 'should handle very large line numbers',
        input: [1000, 1001, 1002, 2000, 3000, 3001],
        expected: ['lines: 1000-1002', 'line: 2000', 'lines: 3000-3001'],
      },
      {
        name: 'should handle edge case with single consecutive pair at end',
        input: [1, 5, 8, 9],
        expected: ['line: 1', 'line: 5', 'lines: 8-9'],
      },
      {
        name: 'should handle edge case with single consecutive pair at start',
        input: [1, 2, 5, 8],
        expected: ['lines: 1-2', 'line: 5', 'line: 8'],
      },
      {
        name: 'should handle edge case with single consecutive pair in middle',
        input: [1, 5, 6, 10],
        expected: ['line: 1', 'lines: 5-6', 'line: 10'],
      },
      {
        name: 'should handle realistic code search scenarios',
        input: [5, 12, 13, 14, 25, 28, 29, 45],
        expected: ['line: 5', 'lines: 12-14', 'line: 25', 'lines: 28-29', 'line: 45'],
        note: 'Simulate finding matches on various lines in a file',
      },
      {
        name: 'should handle dense consecutive sequences',
        input: [1, 3, 4, 6, 7, 9, 10, 11, 13],
        expected: ['line: 1', 'lines: 3-4', 'lines: 6-7', 'lines: 9-11', 'line: 13'],
        note: 'Test with many small gaps',
      },
    ];

    testCases.forEach(({ name, input, expected, note }) => {
      test(name, () => {
        const result = groupConsecutiveLines(input);
        expect(result).toEqual(expected);
      });
    });

    test('should format consecutive ranges correctly', () => {
      // Additional test for format validation
      const result = groupConsecutiveLines([1, 2, 4]);
      expect(result[0]).toBe('lines: 1-2');
      expect(result[1]).toBe('line: 4');
    });
  });
});
