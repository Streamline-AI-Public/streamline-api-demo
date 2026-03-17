import crypto from 'node:crypto';
import events from 'node:events';
import * as httpMessageSig from 'http-message-sig';
import type * as http from 'node:http';
import util from 'node:util';
import express from 'express';
import * as sh from 'structured-headers';
import * as env from './lib/env.js';

const cryptoVerify = util.promisify(crypto.verify);
const app = express();
const reqBodyData = Symbol('reqBodyData');

interface IncomingMessageData {
  [reqBodyData]?: {
    rawBody: Buffer;
    isJson: true;
  };
}

// Trust `X-Forwarded-*` headers from a localhost tunnel, if any.
app.set('trust proxy', 'loopback');

app.use(
  express.json({
    verify(req: http.IncomingMessage & IncomingMessageData, res, buffer, encoding) {
      req[reqBodyData] = {
        rawBody: buffer,
        isJson: true,
      };
    },
  }),
);

// Tolerate a clock skew of up to 2s when checking signature timestamps.
const clockSkew = 2_000;

app.post('/webhook', async function (req: express.Request & IncomingMessageData, res) {
  // Step 1: Verify JSON `Content-Type`.
  const bodyData = req[reqBodyData];
  console.log('Received webhook event:', req.body);
  if (!bodyData) {
    // If `bodyData` has not been assigned, then the request `Content-Type` is
    // not JSON.
    throw Object.assign(new Error('`Content-Type` must be JSON.'), {
      contentType: req.get('Content-Type'),
    });
  }
  // Step 2: Verify `Content-Digest`.
  const sha256ContentDigest = getSha256ContentDigest(req.get('Content-Digest'));
  const sha256BodyHash = crypto.hash('sha256', bodyData.rawBody, 'buffer');
  if (
    sha256ContentDigest.length !== sha256BodyHash.length ||
    !crypto.timingSafeEqual(sha256ContentDigest, sha256BodyHash)
  ) {
    throw Object.assign(new Error('`Content-Digest` `sha-256` value does not match body hash.'), {
      sha256ContentDigest: sha256ContentDigest.toString('base64'),
      sha256BodyHash: sha256BodyHash.toString('base64'),
    });
  }
  const requestLike: httpMessageSig.RequestLike = {
    method: req.method,
    url: new URL(req.url, `${req.protocol}://${req.host}${req.url}`).href,
    // `httpMessageSig` should account for header values being potentially
    // `undefined`.
    headers: req.headers as Record<string, string | string[]>,
    protocol: req.protocol,
  };
  // Step 3: Verify HTTP message signature.
  await httpMessageSig.verify(requestLike, async function (base, signature, params) {
    if (params.alg !== 'ed25519') {
      throw Object.assign(new Error('Signature is not Ed25519.'), {
        params,
      });
    }
    const now = Date.now();
    const { created, expires } = params;
    if (!created) {
      throw Object.assign(new Error('Signature is missing `created` parameter.'), { params });
    }
    if (+created > now + clockSkew) {
      throw Object.assign(new Error('Signature is created in the future.'), {
        clockSkew,
        params,
      });
    }
    if (!expires) {
      throw Object.assign(new Error('Signature is missing `expires` parameter.'), { params });
    }
    if (+expires < now - clockSkew) {
      throw Object.assign(new Error('Signature is expired.'), {
        clockSkew,
        params,
      });
    }
    const isSignatureValid = await cryptoVerify(null, Buffer.from(base), env.WEBHOOK_PUBLIC_KEY, signature);
    if (!isSignatureValid) {
      throw new Error('Signature is invalid.');
    }
  });
  // Handle the webhook payload here. req.body contains the event data.
  if (req.body.type === 'webhook_verification') {
    return res.json({
      challengeResponse: crypto.hash('sha256', `${req.body.challenge}-streamline-webhook-challenge`, 'base64'),
    });
  }
  res.sendStatus(204);
});

function getSha256ContentDigest(contentDigest: string | undefined) {
  if (!contentDigest) {
    throw new Error('`Content-Digest` must be provided.');
  }
  const parsedValue = sh.parseDictionary(contentDigest);
  const sha256Hash = parsedValue.get('sha-256');
  if (!sha256Hash) {
    throw Object.assign(new Error('`Content-Digest` must have `sha-256` value.'), { contentDigest });
  }
  const [hash, parameters] = sha256Hash;
  if (!(hash instanceof ArrayBuffer)) {
    throw Object.assign(new Error('`Content-Digest` `sha-256` value must be a byte sequence.'), { contentDigest });
  }
  if (parameters.size) {
    throw Object.assign(new Error('`Content-Digest` `sha-256` value must not have any parameters.'), { contentDigest });
  }
  return Buffer.from(hash);
}

const listenParams = {
  host: 'localhost',
  port: env.WEBHOOK_SERVER_PORT,
  exclusive: true,
};

const server = app.listen(listenParams);
await events.once(server, 'listening');
console.log('Webhook server listening:', server.address());
