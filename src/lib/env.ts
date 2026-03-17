import crypto from 'node:crypto';

// This module wraps `process.loadEnvFile()` so that it can be `import`ed
// before any other modules.
process.loadEnvFile(new URL(import.meta.resolve('../../.env')));

const { API_URL, AUTH_KEY_ID, AUTH_PRIVATE_KEY, PROXY_PORT, WEBHOOK_PUBLIC_KEY, WEBHOOK_SERVER_PORT } =
  // Mark variables as strings because `export` does not respect type
  // narrowing.
  process.env as Record<string, string>;

if (!API_URL || !AUTH_KEY_ID || !AUTH_PRIVATE_KEY || !PROXY_PORT || !WEBHOOK_PUBLIC_KEY) {
  throw new Error('Some .env variables are missing or empty.');
}

const authPrivateKey = (function () {
  const key = crypto.createPrivateKey(AUTH_PRIVATE_KEY!);
  if (key.type !== 'private' || key.asymmetricKeyType !== 'ed25519') {
    throw Object.assign(new Error('`AUTH_PRIVATE_KEY` is not an Ed25519 private key.'), {
      keyType: key.type,
      keyAsymmetricKeyType: key.asymmetricKeyType,
    });
  }
  return key;
})();

const webhookPrivateKey = (function () {
  const key = crypto.createPublicKey(WEBHOOK_PUBLIC_KEY!);
  if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') {
    throw Object.assign(new Error('`WEBHOOK_PUBLIC_KEY` is not an Ed25519 public key.'), {
      keyType: key.type,
      keyAsymmetricKeyType: key.asymmetricKeyType,
    });
  }
  return key;
})();

const apiUrl = new URL(API_URL!);

export {
  AUTH_KEY_ID,
  PROXY_PORT,
  authPrivateKey as AUTH_PRIVATE_KEY,
  apiUrl as API_URL,
  webhookPrivateKey as WEBHOOK_PUBLIC_KEY,
  WEBHOOK_SERVER_PORT,
};
