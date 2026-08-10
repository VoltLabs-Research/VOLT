# @voltstack/daemon-cluster-client

Node.js SDK for cluster-daemon ↔ Volt server communication: HTTP enrollment,
the socket.io control connection, the heartbeat loop, and inbound command
dispatch over the reverse channel.

## Install

```bash
npm install @voltstack/daemon-cluster-client socket.io-client
```

`socket.io-client` (>=4) is a peer dependency.

## Quick start

```ts
import { ClusterDaemonClient } from '@voltstack/daemon-cluster-client';

const client = new ClusterDaemonClient({
    serverUrl: 'https://cloud.voltlabs.io',
    controlSocketUrl: 'wss://cloud.voltlabs.io',
    credentials: {
        teamClusterId: process.env.TEAM_CLUSTER_ID!,
        daemonPassword: process.env.TEAM_CLUSTER_DAEMON_PASSWORD!,
        enrollmentToken: process.env.TEAM_CLUSTER_ENROLLMENT_TOKEN,
    },
    enrollment: { url: 'https://cloud.voltlabs.io/api/team-clusters/abc/healthcheck' },
});

// Register inbound command handlers once — they survive reconnections.
client.registerHandler('runtime.uninstall', {
    async handle(payload) {
        await uninstall(payload);
        return { data: { ok: true } };
    },
});

client.onError((err) => console.error(err.code, err.message));
await client.connect();
```

`connect()` performs enrollment (if an `enrollmentToken` is present, rotating the
daemon password), establishes the control socket and starts the heartbeat loop.

## Sending commands

`sendCommand(name, payload?, timeout?)` issues a request/response command and
resolves with the server's response data. A single response dispatcher routes
replies by `requestId`, so many concurrent commands do not stack per-call socket
listeners. Pending commands are rejected on disconnect.

## Errors

All failures throw `DaemonClientError` with a discriminable `code`
(`DaemonClientErrorCode`): `ENROLLMENT_FAILED`, `SOCKET_CONNECTION_FAILED`,
`SOCKET_NOT_READY`, `COMMAND_TIMEOUT`, `COMMAND_REJECTED`, `HANDLER_ERROR`,
`EMIT_FAILED`, `HEARTBEAT_FAILED`. Switch on `code` rather than parsing messages.

## Develop

```bash
npm run build       # bundle to dist/ (ESM + CJS + d.ts)
npm run typecheck   # tsc --noEmit
npm test            # node:test suite over tests/
```
