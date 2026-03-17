import crypto from 'node:crypto';
import events from 'node:events';
import http from 'node:http';
import https from 'node:https';
import stream from 'node:stream';
import streamConsumers from 'node:stream/consumers';
import * as env from './env.js';
import * as utils from './utils.js';
import type * as sh from 'structured-headers';
import type * as streamWeb from 'node:stream/web';

const apiBaseUrl = new URL('/api/v0', env.API_URL);
const httpModule = { 'https:': https, 'http:': http }[apiBaseUrl.protocol]!;

async function getWithSignature(url: URL, errorMessage: string): Promise<Response> {
  const signatureComponents = new Map([
    ['@method', 'GET'],
    ['@target-uri', url.href],
  ]);
  const signatureParams = utils.generateSignatureParams(signatureComponents);
  const signature = await utils.generateSignature(signatureComponents, signatureParams);
  const response = await fetch(url, {
    headers: {
      'Signature-Input': utils.encodeSignatureInput(signatureParams),
      Signature: utils.encodeSignature(signature),
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error(errorMessage), {
      status: `${response.status} ${response.statusText}`,
      body: await response.text(),
    });
  }
  return response;
}

// Helper for multipart/form-data POST with signature and trailers
async function postMultipartWithSignature({
  url,
  method = 'POST',
  formData,
}: {
  url: URL;
  method?: string;
  formData: FormData;
}): Promise<any> {
  const multipartRequest = new Request('http://unused', {
    method,
    body: formData,
  });
  const contentType = multipartRequest.headers.get('Content-Type')!;
  const signatureComponents: utils.SignatureComponents = new Map([
    ['@method', method],
    ['@target-uri', url.href],
    ['content-type', contentType],
    [utils.CONTENT_DIGEST_TRAILER, ''],
  ] as [sh.Item | sh.BareItem, string][]);
  const signatureParams = utils.generateSignatureParams(signatureComponents);
  const headers = {
    'Content-Type': contentType,
    Trailer: 'Content-Digest, Signature',
    'Signature-Input': utils.encodeSignatureInput(signatureParams),
  };
  const httpRequest = httpModule.request(url, { method, headers });
  const [[httpResponse]] = await Promise.all([
    events.once(httpRequest, 'response'),
    (async function () {
      const hash = crypto.createHash('sha256');
      await stream.promises.pipeline(
        multipartRequest.body as streamWeb.ReadableStream,
        new stream.Transform({
          transform(chunk, encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
          },
        }),
        httpRequest,
        { end: false },
      );
      const contentDigest = utils.encodeContentDigest(hash.digest());
      signatureComponents.set(utils.CONTENT_DIGEST_TRAILER, contentDigest);
      const signature = await utils.generateSignature(signatureComponents, signatureParams);
      httpRequest.addTrailers({
        'Content-Digest': contentDigest,
        Signature: utils.encodeSignature(signature),
      });
      httpRequest.end();
    })(),
  ]);
  if (httpResponse.statusCode < 200 || httpResponse.statusCode > 299) {
    throw Object.assign(new Error('Error while posting multipart request.'), {
      status: `${httpResponse.statusCode} ${httpResponse.statusMessage}`,
      body: await streamConsumers.text(httpResponse),
    });
  }
  return httpResponse;
}

async function postJsonWithSignature({
  url,
  method = 'POST',
  data,
  errorMessage,
}: {
  url: URL;
  method?: string;
  data: any;
  errorMessage: string;
}): Promise<any> {
  const body = JSON.stringify(data);
  const contentType = 'application/json';
  const contentDigest = utils.encodeContentDigest(crypto.hash('sha256', body, 'buffer'));
  const signatureComponents = new Map([
    ['@method', method],
    ['@target-uri', url.href],
    ['content-type', contentType],
    ['content-digest', contentDigest],
  ]);
  const signatureParams = utils.generateSignatureParams(signatureComponents);
  const signature = await utils.generateSignature(signatureComponents, signatureParams);
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': contentType,
      'Content-Digest': contentDigest,
      'Signature-Input': utils.encodeSignatureInput(signatureParams),
      Signature: utils.encodeSignature(signature),
    },
    body,
  });
  if (!response.ok) {
    throw Object.assign(new Error(errorMessage), {
      status: `${response.status} ${response.statusText}`,
      body: await response.text(),
    });
  }
  return response;
}

export interface RequestFormField {
  type: string;
  title: string;
  options?: string[];
  [key: string]: unknown; // allow additional properties
}

export interface RequestForm {
  id: string;
  status: string;
  formNameLong: string;
  longDescription: string;
  shortDescription: string;
  fields: Record<string, RequestFormField>;
  [key: string]: unknown;
}

export async function getRequestForms(): Promise<RequestForm[]> {
  const url = new URL(`${apiBaseUrl}/request-forms`);
  const response = await getWithSignature(url, 'Error while fetching request forms.');
  return (await response.json()) as RequestForm[];
}

export async function queryRequests(queryString: string = ''): Promise<any> {
  const url = new URL(`${apiBaseUrl}/requests${queryString ? `?${queryString}` : ''}`);
  const response = await getWithSignature(url, 'Error while querying requests.');
  return await response.json();
}

export async function createRequestWithoutFiles(requestData: any) {
  const url = new URL(`${apiBaseUrl}/requests`);
  const httpResponse = await postJsonWithSignature({
    url,
    data: requestData,
    errorMessage: 'Error while creating request.',
  });
  console.log(`${httpResponse.statusCode} ${httpResponse.statusMessage}`);
  return await httpResponse.json();
}

export async function createRequestWithFiles(formData: FormData) {
  const url = new URL(`${apiBaseUrl}/requests`);
  const httpResponse = await postMultipartWithSignature({ url, formData });
  console.log(`${httpResponse.statusCode} ${httpResponse.statusMessage}`);
  return await streamConsumers.json(httpResponse);
}

export async function addAttachmentsToRequestWithFiles(requestId: string, formData: FormData) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  const url = new URL(`${apiBaseUrl}/requests/${requestId}/attachments`);
  const httpResponse = await postMultipartWithSignature({ url, formData });
  console.log(`${httpResponse.statusCode} ${httpResponse.statusMessage}`);
  return null;
}

export async function addAttachmentsToRequestWithoutFiles(requestId: string, requestData: any) {
  const url = new URL(`${apiBaseUrl}/requests/${requestId}/attachments`);
  const response = await postJsonWithSignature({
    url,
    data: requestData,
    errorMessage: 'Error while adding attachments to request without files.',
  });
  console.log(`${response.status} ${response.statusText}`);
  return null;
}

export async function updateRequest(
  requestId: string,
  updateData: {
    assigneeId?: string | null;
    requestorId?: string | null;
    status?: string;
    answers?: any;
  },
) {
  if (!requestId) {
    throw new Error('requestId is required');
  }
  const url = new URL(`${apiBaseUrl}/requests/${requestId}`);
  const response = await postJsonWithSignature({
    url,
    method: 'PUT',
    data: updateData,
    errorMessage: 'Error while updating request.',
  });
  console.log(`${response.status} ${response.statusText}`);
  return null;
}
