/**
 * Neutral, cross-module repository port for the StoragePlacement aggregate.
 *
 * Extracted from `@modules/cluster/domain/port/IStoragePlacementRepository`
 * during the detachable-modules migration. The concrete repository stays in the
 * cluster module, registered under `CLUSTER_SERVICE_TOKENS.StoragePlacementRepository`
 * (same `Symbol.for` key as the cluster module's
 * `CLUSTER_TOKENS.StoragePlacementRepository`, so resolution is byte-identical).
 * Consumers `@inject(...)` against this port without importing `@modules/cluster`.
 * The original port file re-exports this so existing importers compile unchanged.
 *
 * PHASE-2 FOLLOW-UP (type-only recoupling): the entity `StoragePlacement` is a
 * class (with `props` + an `id` getter), so it cannot be moved into this pure-type
 * contracts layer without dragging runtime in. It is imported here with
 * `import type` only (erased by tsc — no runtime/decorator coupling). The scope
 * and state unions already live neutrally in `@shared/domain/contracts`.
 * Replacing the class with a structural entity contract is deferred.
 */
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type StoragePlacement from '@modules/cluster/domain/entities/StoragePlacement';
import type { StoragePlacementProps } from '@modules/cluster/domain/entities/StoragePlacement';

export interface IStoragePlacementRepository extends IBaseRepository<StoragePlacement, StoragePlacementProps> {
    findByScope(scopeType: StoragePlacementProps['scopeType'], scopeId: string): Promise<StoragePlacement | null>;
    upsertByScope(
        scopeType: StoragePlacementProps['scopeType'],
        scopeId: string,
        data: Partial<StoragePlacementProps>
    ): Promise<StoragePlacement>;
    listByPrimaryClusterId(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]>;
}
