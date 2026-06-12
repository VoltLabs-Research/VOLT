/**
 * Neutral mirror of the team-cluster daemon response-type enum.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): this enum
 * is a runtime VALUE (used as `.Json`/`.Buffer`/`.Stream`), so it cannot be a
 * type-only import. Hosting it here lets the shared daemon client reference it
 * without value-importing `@modules/cluster`. The cluster util
 * `teamClusterSocket.ts` re-exports it, so existing cluster importers are
 * unchanged. Values are byte-identical to what is emitted/consumed today.
 */
export enum TeamClusterDaemonResponseType {
    Json = 'json',
    Buffer = 'buffer',
    Stream = 'stream'
}
