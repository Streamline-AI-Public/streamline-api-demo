# Streamline AI API Demo

This repository contains example TypeScript code demonstrating how to integrate with the Streamline AI API, including creating and updating requests, managing attachments, validating webhooks, and signing HTTP requests. Additional documentation can be found at [https://www.streamline.ai/api-documentation](https://www.streamline.ai/api-documentation).

## Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [pnpm](https://pnpm.io/)

## Setup

1. Install dependencies:

    ```sh
    pnpm install
    ```

2. Copy `.env-template` to `.env`:

    ```sh
    cp .env-template .env
    ```

3. Populate `.env` with credentials from the Streamline API integration page:
    - `AUTH_KEY_ID` — your API key ID
    - `AUTH_PRIVATE_KEY` — your Ed25519 private key
    - `WEBHOOK_PUBLIC_KEY` — your webhook signing public key
    - `API_URL` — your Streamline instance URL (e.g. `https://yourcompany.streamline.ai`)

## Webhook Setup

`webhook-server.ts` must be reachable from the internet to receive webhook events from Streamline. For local development, use a tunneling tool such as [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose your local server.

Once running, register the public webhook URL in the Streamline dashboard. The server handles the `webhook_verification` challenge automatically.

## Proxy Server

`proxy-server.ts` is a local development tool that proxies HTTP requests to the Streamline API, automatically signing each request with your credentials. It is not intended for production use.

## Usage

- `pnpm run create-request`

    Runs `src/create-request.ts`, which shows how to query request forms, and create requests (with and without files).

- `pnpm run update-request <requestId> <newStatus>`

    Runs `src/update-request.ts`, which updates a request's status. Requires a `requestId` and the new status value as arguments.

    Example:

    pnpm run update-request request_12345 review

    The update endpoint also allows updating `assigneeId`, `requestorId`, and `answers` (see API docs and src/lib/api.ts). To update those fields, modify the script or call `api.updateRequest` directly with the desired fields.

- `pnpm run add-attachments-to-request-with-files <requestId>`

    Runs `src/add-attachments-to-request-with-files.ts`, which demonstrates how to add attachments (including files) to an existing request. Requires a `requestId` argument.

- `pnpm run add-attachments-to-request-without-files <requestId>`

    Runs `src/add-attachments-to-request-without-files.ts`, which demonstrates how to add non-file attachments (such as links) to an existing request. Requires a `requestId` argument.

- `pnpm run query-requests`

    Runs `src/query-requests.ts`, which demonstrates how to query for requests using OData system query options (e.g., filtering, ordering, and counting requests). You can modify the query string in the script to test different queries.

- `pnpm run start-webhook-server`

    Runs `src/webhook-server.ts`, which shows how to validate webhook payloads from Streamline and how to correctly respond to the `webhook_verification` challenge.

- `pnpm run start-proxy-server`

    Runs `src/proxy-server.ts`, which proxies local HTTP requests as signed HTTP requests to Streamline. This is useful to explore the Streamline API during development without worrying about authentication logic.
