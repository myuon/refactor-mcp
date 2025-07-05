export function groupConsecutiveLines(lineNumbers: number[]): string[] {
  if (lineNumbers.length === 0) return [];
  if (lineNumbers.length === 1) return [`line: ${lineNumbers[0]}`];

  const groups: string[] = [];
  let start = lineNumbers[0];
  let end = lineNumbers[0];

  for (let i = 1; i < lineNumbers.length; i++) {
    if (lineNumbers[i] === end + 1) {
      end = lineNumbers[i];
    } else {
      if (start === end) {
        groups.push(`line: ${start}`);
      } else {
        groups.push(`lines: ${start}-${end}`);
      }
      start = lineNumbers[i];
      end = lineNumbers[i];
    }
  }

  if (start === end) {
    groups.push(`line: ${start}`);
  } else {
    groups.push(`lines: ${start}-${end}`);
  }

  return groups;
}
