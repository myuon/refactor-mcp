import { describe, test, expect } from 'vitest';
import { groupConsecutiveLines } from '../../src/utils/line-utils.js';

describe('Line Utils', () => {
  describe('groupConsecutiveLines', () => {
    test('should handle empty array', () => {
      const result = groupConsecutiveLines([]);
      expect(result).toEqual([]);
    });

    test('should handle single line number', () => {
      const result = groupConsecutiveLines([5]);
      expect(result).toEqual(['line: 5']);
    });

    test('should handle two consecutive line numbers', () => {
      const result = groupConsecutiveLines([1, 2]);
      expect(result).toEqual(['lines: 1-2']);
    });

    test('should handle multiple consecutive line numbers', () => {
      const result = groupConsecutiveLines([1, 2, 3, 4, 5]);
      expect(result).toEqual(['lines: 1-5']);
    });

    test('should handle non-consecutive line numbers', () => {
      const result = groupConsecutiveLines([1, 3, 5]);
      expect(result).toEqual(['line: 1', 'line: 3', 'line: 5']);
    });

    test('should handle mixed consecutive and non-consecutive line numbers', () => {
      const result = groupConsecutiveLines([1, 2, 3, 5, 7, 8, 10]);
      expect(result).toEqual([
        'lines: 1-3',
        'line: 5',
        'lines: 7-8',
        'line: 10',
      ]);
    });

    test('should handle consecutive pairs', () => {
      const result = groupConsecutiveLines([1, 2, 4, 5, 7, 8]);
      expect(result).toEqual(['lines: 1-2', 'lines: 4-5', 'lines: 7-8']);
    });

    test('should handle large consecutive range', () => {
      const input = Array.from({ length: 100 }, (_, i) => i + 1);
      const result = groupConsecutiveLines(input);
      expect(result).toEqual(['lines: 1-100']);
    });

    test('should handle unsorted input correctly', () => {
      const result = groupConsecutiveLines([3, 1, 2, 5, 4]);
      // Note: function assumes sorted input, so this tests current behavior
      // Function processes in order without sorting
      expect(result).toEqual(['line: 3', 'lines: 1-2', 'line: 5', 'line: 4']);
    });

    test('should handle duplicate line numbers', () => {
      const result = groupConsecutiveLines([1, 1, 2, 2, 3]);
      // Note: function assumes unique input, this tests current behavior
      // Function processes duplicates as separate items
      expect(result).toEqual(['line: 1', 'lines: 1-2', 'lines: 2-3']);
    });

    test('should handle gaps of different sizes', () => {
      const result = groupConsecutiveLines([1, 2, 5, 6, 7, 10, 15, 16]);
      expect(result).toEqual([
        'lines: 1-2',
        'lines: 5-7',
        'line: 10',
        'lines: 15-16',
      ]);
    });

    test('should handle single lines between consecutive groups', () => {
      const result = groupConsecutiveLines([1, 2, 4, 6, 7, 8]);
      expect(result).toEqual(['lines: 1-2', 'line: 4', 'lines: 6-8']);
    });

    test('should handle alternating consecutive and single lines', () => {
      const result = groupConsecutiveLines([1, 3, 4, 6, 8, 9, 10, 12]);
      expect(result).toEqual([
        'line: 1',
        'lines: 3-4',
        'line: 6',
        'lines: 8-10',
        'line: 12',
      ]);
    });

    test('should handle very large line numbers', () => {
      const result = groupConsecutiveLines([
        1000, 1001, 1002, 2000, 3000, 3001,
      ]);
      expect(result).toEqual([
        'lines: 1000-1002',
        'line: 2000',
        'lines: 3000-3001',
      ]);
    });

    test('should handle edge case with single consecutive pair at end', () => {
      const result = groupConsecutiveLines([1, 5, 8, 9]);
      expect(result).toEqual(['line: 1', 'line: 5', 'lines: 8-9']);
    });

    test('should handle edge case with single consecutive pair at start', () => {
      const result = groupConsecutiveLines([1, 2, 5, 8]);
      expect(result).toEqual(['lines: 1-2', 'line: 5', 'line: 8']);
    });

    test('should handle edge case with single consecutive pair in middle', () => {
      const result = groupConsecutiveLines([1, 5, 6, 10]);
      expect(result).toEqual(['line: 1', 'lines: 5-6', 'line: 10']);
    });

    test('should format consecutive ranges correctly', () => {
      // Test that consecutive ranges use "lines" and singles use "line"
      const result = groupConsecutiveLines([1, 2, 4]);
      expect(result[0]).toBe('lines: 1-2');
      expect(result[1]).toBe('line: 4');
    });

    test('should handle realistic code search scenarios', () => {
      // Simulate finding matches on various lines in a file
      const matchLines = [5, 12, 13, 14, 25, 28, 29, 45];
      const result = groupConsecutiveLines(matchLines);
      expect(result).toEqual([
        'line: 5',
        'lines: 12-14',
        'line: 25',
        'lines: 28-29',
        'line: 45',
      ]);
    });

    test('should handle dense consecutive sequences', () => {
      // Test with many small gaps
      const result = groupConsecutiveLines([1, 3, 4, 6, 7, 9, 10, 11, 13]);
      expect(result).toEqual([
        'line: 1',
        'lines: 3-4',
        'lines: 6-7',
        'lines: 9-11',
        'line: 13',
      ]);
    });
  });
});
