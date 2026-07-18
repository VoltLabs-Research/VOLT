/**
 * Neutral, cross-module repository port for the ClusterTransferJob aggregate.
 *
 * Extracted from `@modules/cluster/ports/IClusterTransferJobRepository`
 * during the detachable-modules migration. The concrete repository stays in the
 * cluster module, registered under `CLUSTER_SERVICE_TOKENS.ClusterTransferJobRepository`
 * (same `Symbol.for` key as the cluster module's
 * `CLUSTER_TOKENS.ClusterTransferJobRepository`, so resolution is byte-identical).
 * Consumers `@inject(...)` against this port without importing `@modules/cluster`.
 * The original port file re-exports this so existing importers compile unchanged.
 *
 * PHASE-2 FOLLOW-UP (type-only recoupling): the entity `ClusterTransferJob` is a
 * class (with `props` + an `id` getter), so it cannot be moved into this pure-type
 * contracts layer without dragging runtime in. It is imported here with
 * `import type` only (erased by tsc — no runtime/decorator coupling). Replacing
 * the class with a structural entity contract is deferred.
 */
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type ClusterTransferJob from '@modules/cluster/entities/ClusterTransferJob';
import type { ClusterTransferJobProps } from '@modules/cluster/entities/ClusterTransferJob';

export interface IClusterTransferJobRepository extends IBaseRepository<ClusterTransferJob, ClusterTransferJobProps> {
    findOpenByScope(
        scopeType: ClusterTransferJobProps['scopeType'],
        scopeId: string
    ): Promise<ClusterTransferJob | null>;
    findNextRunnable(): Promise<ClusterTransferJob | null>;
    listOpenByClusterIds(teamId: string, clusterIds: string[]): Promise<ClusterTransferJob[]>;
    claimNextRunnable(claimantId: string, ttlMs: number): Promise<ClusterTransferJob | null>;
    renewClaim(jobId: string, claimantId: string, ttlMs: number): Promise<boolean>;
    releaseClaim(jobId: string, claimantId: string): Promise<void>;
    updateRuntimeState(jobId: string, runtimeState: Record<string, unknown>): Promise<ClusterTransferJob | null>;
}
