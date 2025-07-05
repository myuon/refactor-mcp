// Sample JavaScript file for testing
function oldFunction() {
  const oldVariable = 'test';
  let result = oldVariable.toUpperCase();
  return result;
}

export function exportedFunction() {
  console.log('This is exported');
  return oldFunction();
}

const CONSTANT_VALUE = 42;

// Function with legacy_sdk import pattern
import legacy_sdk from 'old-package';
const localVariable = 'should not change';
legacy_sdk.initialize();