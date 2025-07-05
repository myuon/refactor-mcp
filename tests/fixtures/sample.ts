// Sample TypeScript file for testing
interface TestInterface {
  id: number;
  name: string;
}

export class TestClass {
  private data: TestInterface;

  constructor(data: TestInterface) {
    this.data = data;
  }

  public getData(): TestInterface {
    return this.data;
  }

  public updateName(newName: string): void {
    this.data.name = newName;
  }
}

export function helperFunction(input: string): string {
  return input.trim().toLowerCase();
}

export const CONFIG = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};
