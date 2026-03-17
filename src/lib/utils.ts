import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import util from 'node:util';
import * as sh from 'structured-headers';
import * as api from './api.js';
import * as env from './env.js';

const cryptoSign = util.promisify(crypto.sign);
const SIGNATURE_LABEL = 'sig';

export const CONTENT_DIGEST_TRAILER: sh.Item = ['content-digest', new Map([['tr', true]])];

export type SignatureComponents = Map<sh.Item | sh.BareItem, string>;

export function generateSignatureParams(signatureComponents: SignatureComponents): string {
  const createdAt = Math.round(Date.now() / 1_000);
  return sh.serializeInnerList([
    // The type signature of `sh.serializeInnerList` is too strict; it supports
    // `sh.BareItem` and `sh.Item` elements.
    signatureComponents.keys().toArray() as sh.Item[],
    new Map<string, sh.BareItem>([
      ['alg', 'ed25519'],
      ['created', createdAt],
      ['expires', createdAt + 60],
      ['keyid', env.AUTH_KEY_ID],
    ]),
  ]);
}

function generateSignatureBase(signatureComponents: SignatureComponents, signatureParams: string): Buffer {
  let signatureBase = signatureComponents
    .entries()
    .map(function ([key, value]) {
      // `sh.serializeItem` supports `sh.BareItem` as well as `sh.Item`.
      return `${sh.serializeItem(key as sh.BareItem)}: ${value}\n`;
    })
    .toArray()
    .join('');
  signatureBase += `"@signature-params": ${signatureParams}`;
  return Buffer.from(signatureBase);
}

export async function generateSignature(
  signatureComponents: SignatureComponents,
  signatureParams: string,
): Promise<Buffer> {
  return await cryptoSign(null, generateSignatureBase(signatureComponents, signatureParams), env.AUTH_PRIVATE_KEY);
}

export function generateSignatureSync(signatureComponents: SignatureComponents, signatureParams: string): Buffer {
  // NOTE: Event loop is blocked during synchronous signing because HTTP proxy
  // does not support using an asynchronous operation to delay sending of
  // outgoing request headers.
  return crypto.sign(null, generateSignatureBase(signatureComponents, signatureParams), env.AUTH_PRIVATE_KEY);
}

function encodeBufferValue(buffer: Buffer): string {
  return `:${buffer.toString('base64')}:`;
}

export function encodeContentDigest(sha256Hash: Buffer): string {
  return `sha-256=${encodeBufferValue(sha256Hash)}`;
}

export function encodeSignatureInput(signatureParams: string) {
  return `${SIGNATURE_LABEL}=${signatureParams}`;
}

export function encodeSignature(signature: Buffer) {
  return `${SIGNATURE_LABEL}=${encodeBufferValue(signature)}`;
}

function getSampleAnswerValue(field: any): any {
  switch (field.type) {
    case 'address':
      return {
        type: field.type,
        value: {
          lines: ['1 Market St'],
          locality: 'San Francisco',
          region: 'California',
          postcode: '94105',
          country: 'USA',
        },
      };
    case 'checkbox':
      return {
        type: field.type,
        // Choose all options in the first half of available options.
        value: field.options.slice(0, Math.ceil(field.options.length / 2)),
      };
    case 'currency':
      return {
        type: field.type,
        value: {
          amount: 0.99,
          currencyCode: 'USD',
        },
      };
    case 'duration':
      return {
        type: field.type,
        value: {
          years: 0,
          months: 0,
          weeks: 0,
          days: 1,
        },
      };
    case 'email':
      return {
        type: field.type,
        value: 'hello@example.com',
      };
    case 'number':
      return {
        type: field.type,
        value: 42.42,
      };
    case 'date':
      return {
        type: field.type,
        value: '2000-01-01',
      };
    case 'futureDate':
      return {
        type: field.type,
        // The first 10 chars of an ISO date string are `YYYY-MM-DD`.
        value: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString().slice(0, 10),
      };
    case 'radio':
      return {
        type: field.type,
        value: field.options[0],
      };
    case 'select':
      return {
        type: field.type,
        value: field.options[0],
      };
    case 'paragraph':
      return {
        type: field.type,
        value: 'Hello,\n\nworld!',
      };
    case 'text':
      return {
        type: field.type,
        value: 'Hello, world!',
      };
    case 'richText':
      return {
        type: field.type,
        value: '<i>Hello</i>, <b>world!</b>',
      };
  }
}

export const linkAttachment: Attachment = {
  type: 'link',
  title: 'Google',
  value: 'https://www.google.com',
  starred: false,
};

type Attachment = any;

export function getSampleRequestData(requestForm: api.RequestForm | null, attachments: Attachment[]) {
  if (requestForm) {
    return {
      assigneeId: null,
      requestorId: null,
      requestFormId: requestForm.id,
      status: 'submitted',
      answers: Object.fromEntries(
        Object.entries(requestForm.fields).map(([fieldId, field]) => [fieldId, getSampleAnswerValue(field)]),
      ),
      attachments,
    };
  }

  return {
    attachments,
  };
}

export async function getSampleFormData(requestForm: api.RequestForm | null = null): Promise<FormData> {
  const requestData = getSampleRequestData(requestForm, [
    // Have one file attachment at the beginning and one at the end. This shows
    // how `attachments` determines the order of mixed attachment types, as well
    // as how the order of its file attachments maps to `multipart/form-data`
    // file parts.
    {
      type: 'file',
      starred: false,
    },
    linkAttachment,
    {
      type: 'file',
      starred: true,
    },
  ]);
  const formData = new FormData();
  // The first part of the `multipart/form-data` body is the request JSON.
  // Subsequent parts are files.
  formData.set(
    'request',
    new File([JSON.stringify(requestData)], '', {
      type: 'application/json',
    }),
  );
  const bufferedFile = new File(['Hello, world!'], 'hello-world.txt', {
    type: 'text/plain',
  });
  const fixturesDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../fixtures');
  const exampleReadStream = fs.createReadStream(path.join(fixturesDir, 'example.html'));
  const streamedFile = new File([], 'example.html', { type: 'text/html' });
  // Use a workaround to stream data into Node's native `FormData`.
  // See: https://stackoverflow.com/a/75795888
  Object.defineProperty(streamedFile, 'stream', {
    value() {
      return exampleReadStream;
    },
  });
  formData.append('file', bufferedFile);
  formData.append('file', streamedFile);
  return formData;
}
