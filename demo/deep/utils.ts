export function calculateTotal(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0);
}

export class Calculator {
  calculateTotal(values: number[]): number {
    return values.reduce((acc, val) => acc + val, 0);
  }
}