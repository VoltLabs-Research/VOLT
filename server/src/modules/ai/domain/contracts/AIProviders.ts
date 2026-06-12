/**
 * Re-export shim. Canonical AI provider catalog now lives in the neutral
 * `shared/contracts` layer (detachable-modules migration). Existing
 * `@modules/ai/domain/contracts/AIProviders` importers keep working unchanged.
 */
export { AIProvider, AI_PROVIDERS, AI_PROVIDER_NAMES, AI_PROVIDER_DESCRIPTIONS } from '@shared/contracts/types/AIProviders';
