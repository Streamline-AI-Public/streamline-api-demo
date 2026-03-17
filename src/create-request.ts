import * as api from './lib/api.js';
import * as utils from './lib/utils.js';

async function getSampleRequestForm(): Promise<api.RequestForm> {
  const requestForms = await api.getRequestForms();
  if (!requestForms.length) {
    throw new Error('No active request forms found.');
  }
  console.log('Request forms length:', requestForms.length);
  // Filter for forms that are enabled.
  const enabledRequestForms = requestForms.filter((form) => form.status === 'enabled');
  console.log('Enabled request forms length:', enabledRequestForms.length);
  // For sake of example, choose the most recent request form.
  const form = enabledRequestForms.at(-1);
  if (!form) {
    throw new Error('No enabled request forms found.');
  }
  return form;
}

async function createSampleRequestWithoutFiles(requestForm: api.RequestForm) {
  const result = await api.createRequestWithoutFiles(utils.getSampleRequestData(requestForm, [utils.linkAttachment]));
  console.log('Successfully created request without files:', result);
}

async function createSampleRequestWithFiles(requestForm: api.RequestForm) {
  const formData = await utils.getSampleFormData(requestForm);
  const result = await api.createRequestWithFiles(formData);
  console.log('Successfully created request with files:', result);
}

async function main() {
  const requestForm = await getSampleRequestForm();
  // Example 1. Create request without files.
  // await createSampleRequestWithoutFiles(requestForm);
  // Example 2. Create request with files.
  await createSampleRequestWithFiles(requestForm);
}

await main();
