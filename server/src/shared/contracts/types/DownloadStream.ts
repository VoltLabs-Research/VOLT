import type { Readable } from 'node:stream';

/**
 * Neutral cross-module type for a streamed download result. Owned conceptually
 * by the plugin module; referenced by cluster's archive port and others.
 * Canonical home in `shared/contracts`. The original
 * `@modules/plugin/contracts/plugin/DownloadStream` re-exports this.
 */
export interface DownloadStreamOutputDTO {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}
