function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

const items = [
  { name: 'apple', price: 100 },
  { name: 'banana', price: 80 }
];

console.log('Total:', calculateTotal(items));