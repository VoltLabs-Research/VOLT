/**
 * `SHARED_TOKENS` — the long-standing aggregate of cross-module DI token symbols.
 *
 * The single source of truth now lives in the neutral `shared/contracts` layer.
 * This file COMPOSES that source so the legacy
 * `import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens'`
 * keeps working unchanged. The symbols are identical `Symbol.for(...)` instances,
 * so every registration and resolution behaves exactly as before.
 */
import { INFRA_TOKENS } from '@shared/contracts/tokens/InfraTokens';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';

export const SHARED_TOKENS = Object.freeze({
    ...INFRA_TOKENS,
    ...CLUSTER_ACCESS_TOKENS
});
