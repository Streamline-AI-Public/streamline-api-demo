import * as api from './lib/api.js';

async function main() {
  const requestId = process.argv[2];
  const newStatus = process.argv[3];
  if (!requestId || !newStatus) {
    console.error('Usage: pnpm run update-request <requestId> <newStatus>');
    process.exit(1);
  }
  const result = await api.updateRequest(requestId, { status: newStatus });
  console.log('Successfully updated request');
}

await main();
