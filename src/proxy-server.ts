import crypto from 'node:crypto';
import events from 'node:events';
import http from 'node:http';
import * as httpProxy from 'http-proxy-3';
import * as env from './lib/env.js';
import * as utils from './lib/utils.js';

const SUPPORTED_HTTP_METHODS: NodeJS.Dict<boolean> = {
  DELETE: true,
  // `GET` requests do not have a body.
  GET: false,
  PATCH: true,
  POST: true,
  PUT: true,
};

async function main() {
  const proxy = httpProxy.createProxyServer({
    target: env.API_URL,
    changeOrigin: true,
  });
  proxy.on('error', function (err, req, res) {
    console.error('Proxy error:', err.message);
    if (res && !('headersSent' in res && res.headersSent)) {
      (res as http.ServerResponse).statusCode = 502;
      (res as http.ServerResponse).setHeader('Content-Type', 'application/json');
      (res as http.ServerResponse).end(JSON.stringify({ error: 'Bad Gateway' }));
    }
  });
  proxy.on('proxyReq', function (proxyReq, req, res, options, socket) {
    // `req.method` always exists on `http.IncomingMessage` from `http.Server`.
    const method = req.method!;
    const requestHasBody = SUPPORTED_HTTP_METHODS[method];
    if (requestHasBody === undefined) {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: `${http.STATUS_CODES[405]}.` }));
    }
    const targetUrl = new URL(proxyReq.path, env.API_URL);
    const signatureComponents: utils.SignatureComponents = new Map([
      ['@method', method],
      ['@target-uri', targetUrl.href],
    ]);
    if (requestHasBody) {
      // If there is a request body, provide `Signature-Input` in header and
      // `Signature` & `Content-Digest` in trailer.
      const contentType = req.headers['content-type'];
      if (!contentType) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(
          JSON.stringify({
            error: `${method} requests must include \`Content-Type\` header.`,
          }),
        );
      }
      signatureComponents.set('content-type', contentType);
      // Put placeholder component value.
      signatureComponents.set(utils.CONTENT_DIGEST_TRAILER, '');
      const signatureParams = utils.generateSignatureParams(signatureComponents);
      // Make HTTP request use `Transfer-Encoding: chunked`.
      proxyReq.removeHeader('Content-Length');
      proxyReq.setHeader('Transfer-Encoding', 'chunked');
      proxyReq.setHeader('Signature-Input', utils.encodeSignatureInput(signatureParams));
      proxyReq.setHeader('Trailer', 'Content-Digest, Signature');
      const hash = crypto.createHash('sha256');
      req.on('data', function (chunk) {
        hash.update(chunk);
      });
      req.prependOnceListener('end', function () {
        const contentDigest = utils.encodeContentDigest(hash.digest());
        signatureComponents.set(utils.CONTENT_DIGEST_TRAILER, contentDigest);
        const signature = utils.generateSignatureSync(signatureComponents, signatureParams);
        proxyReq.addTrailers({
          'Content-Digest': contentDigest,
          Signature: utils.encodeSignature(signature),
        });
      });
    } else {
      // If there is no request body, provide `Signature-Input` and `Signature`
      // in header.
      const signatureParams = utils.generateSignatureParams(signatureComponents);
      const signature = utils.generateSignatureSync(signatureComponents, signatureParams);
      proxyReq.setHeader('Signature-Input', utils.encodeSignatureInput(signatureParams));
      proxyReq.setHeader('Signature', utils.encodeSignature(signature));
    }
  });
  const server = http.createServer(function (req, res) {
    // Node `http` handles `Expect: 100-continue` request-response internally,
    // so delete this request header to not propagate it further.
    // See: https://nodejs.org/docs/latest-v24.x/api/http.html#event-checkcontinue
    delete req.headers.expect;
    proxy.web(req, res);
  });
  await events.once(
    server.listen({
      host: 'localhost',
      exclusive: true,
      port: env.PROXY_PORT,
    }),
    'listening',
  );
  console.log('Proxy listening:', server.address());
}

await main();
