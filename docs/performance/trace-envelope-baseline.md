# Trace envelope baseline

This document codifies the minimum tracing envelope currently expected across Volt client, Volt server, and ClusterDaemon.

## Required transport fields

| Surface | Required field | Notes |
| --- | --- | --- |
| HTTP request/response | `x-trace-id` header | Forward unchanged when the value already exists; generate once at the edge when absent. |
| Socket auth payload | `traceId` field | Include the trace identifier in auth metadata during connection setup. |
| Daemon and job payload metadata | `traceId` or `traceContext` | Use one of these fields where the payload contract already supports metadata. |
| Logs | `traceId`, `spanName`, `transport`, `durationMs`, `status` | Keep names stable so client/server/daemon logs remain joinable in ad hoc searches. |

## Compatibility expectations

- Client: sends `x-trace-id` on HTTP calls when available and includes `traceId` in socket auth metadata.
- Server: accepts inbound `x-trace-id`, mirrors it into logs, and propagates `traceId` through socket auth and daemon-facing metadata where supported.
- ClusterDaemon: accepts the same `x-trace-id` header and `traceId` or `traceContext` metadata where supported, and emits logs with the common field set.
- Shared rule: `traceId` stays an opaque string. No service should parse or reinterpret another service's identifier.

## Placeholder perf-smoke entrypoints

- `Volt/client`: `npm run perf:smoke` and `npm run perf:baseline`
- `Volt/server`: `npm run perf:smoke` and `npm run perf:baseline`
- `ClusterDaemon`: `npm run perf:smoke` and `npm run perf:baseline`

These commands are intentionally non-invasive. They provide stable CI and local entrypoints that print placeholder JSON until real capture automation lands.

## Baseline capture commands

```bash
# Volt client
cd /home/rodyherrera/Desktop/voltlabs-ecosystem/app/Volt/client
npm run perf:smoke
npm run perf:baseline

# Volt server
cd /home/rodyherrera/Desktop/voltlabs-ecosystem/app/Volt/server
npm run perf:smoke
npm run perf:baseline

# ClusterDaemon
cd /home/rodyherrera/Desktop/voltlabs-ecosystem/app/ClusterDaemon
npm run perf:smoke
npm run perf:baseline
```

## Baseline fields to replace later

- Payload: representative REST response bytes, socket handshake bytes, and daemon/job payload bytes where trace metadata is already supported.
- Latency: client cold start/render, server request duration, daemon job dispatch duration, and representative socket round-trip duration.
- Status: keep placeholder output machine-readable so CI can swap in measured values without changing the command contract.
