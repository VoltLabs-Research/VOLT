# @voltstack/volt-shared

Pure, dependency-free TypeScript utilities and protocol contracts shared across
Volt Node runtimes. Every export is side-effect free and tree-shakeable, and
each concern is available both from the package root and from a dedicated
subpath so consumers pull in only what they use.

> Internal building block. The four modules are intentionally independent — they
> do not share state or types beyond what is noted below.

## Install

```bash
npm install @voltstack/volt-shared
```

## Modules

| Subpath | Purpose |
| --- | --- |
| `@voltstack/volt-shared/binary-envelope` | Fixed 10-byte framing (`opId`, `kind`, length) for binary reverse-channel chunks: `encodeEnvelope`, `decodeEnvelope`, `toUint8Array`. |
| `@voltstack/volt-shared/lammps` | Parse LAMMPS dump/data headers into frame metadata + simulation cell geometry: `parseLammpsMetadata`, `detectLammpsMetadataFormat`. |
| `@voltstack/volt-shared/argument-visibility` | Evaluate plugin-argument `visibleWhen` conditions and sanitize a value map down to the visible, defined arguments. |
| `@voltstack/volt-shared/plugin-reference` | Resolve "plugin reference" argument mappings (copy/translate one plugin's argument into another's config). |

```ts
import { encodeEnvelope, EnvelopeKind } from '@voltstack/volt-shared/binary-envelope';

const frame = encodeEnvelope(opId, EnvelopeKind.StreamChunk, payload);
```

## Develop

```bash
npm run build       # bundle to dist/ (ESM + CJS + d.ts) via tsup
npm run typecheck   # tsc --noEmit
npm test            # node --test (node:test) over tests/
```
