/**
 * Neutral, cross-module type for a streamed raster-frame PNG response.
 *
 * Extracted from `@modules/raster/ports/IRasterFrameReader` during the
 * detachable-modules migration: it is the return shape of the neutral
 * `IRasterStorageService` port, which the trajectory module consumes. Hosting
 * it here lets the port live in `shared/contracts` without importing
 * `@modules/raster`. The owner port file re-exports this so existing importers
 * compile unchanged. Pure type — no `@modules/*` coupling.
 */
import type { Readable } from 'node:stream';

export interface RasterFrameResult {
    stream: Readable;
    contentLength?: number;
    contentType: string;
    cacheControl?: string;
    filename?: string;
}
