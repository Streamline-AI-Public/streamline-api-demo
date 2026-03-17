import * as api from './lib/api.js';
import * as utils from './lib/utils.js';

async function main() {
  const requestId = process.argv[2];
  if (!requestId) {
    console.error(
      'Error: requestId argument is required. Usage: pnpm run add-attachments-to-request-without-files <requestId>',
    );
    process.exit(1);
  }
  const result = await api.addAttachmentsToRequestWithoutFiles(requestId, {
    attachments: [utils.linkAttachment],
  });
  console.log('Successfully added attachments to request');
}

await main();
