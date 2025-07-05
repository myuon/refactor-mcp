#!/usr/bin/env node

import { program } from 'commander';

async function runServer() {
  const { startServer } = await import('./server.js');
  await startServer();
}

async function runCli(args?: string[]) {
  const { startCli } = await import('./cli.js');
  await startCli(args);
}

async function main() {
  // Check if first argument is 'cli'
  if (process.argv[2] === 'cli') {
    // Pass all arguments after 'cli' to the CLI
    const cliArgs = process.argv.slice(3);
    await runCli(cliArgs);
    return;
  }

  // Otherwise run as server
  await runServer();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});