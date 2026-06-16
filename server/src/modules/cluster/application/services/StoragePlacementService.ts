import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type {
    ISceneArtifactRepository,
    ITrajectoryRepository,
    IAnalysisRepository,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import type { Analysis, TrajectoryLike } from '@shared/contracts/types';
import type { IPluginRepository } from '@shared/contracts/ports';
import { resolveAnalysisStorageClusterId, resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import {
    buildAnalysisPlacementBuckets,
    buildPluginBinaryPlacementBuckets,
    buildTrajectoryPlacementBuckets
} from '@modules/cluster/application/utilities/storage-placement-targets';
import StoragePlacement, {
    DEFAULT_STORAGE_PLACEMENT_STATE,
    createStoragePlacementProps
} from '@modules/cluster/domain/entities/StoragePlacement';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { IStoragePlacementRepository } from '@modules/cluster/domain/port/IStoragePlacementRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { StoragePlacementBucketRef, StoragePlacementScopeType, StoragePlacementState } from '@shared/domain/contracts/team-cluster';
import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import type { IStoragePlacementService } from '@modules/cluster/domain/port/IStoragePlacementService';
import { inject } from 'tsyringe';

// Structural "placement view" of a plugin — the only field this service reads.
// Binding the neutral generic IPluginRepository to this lets cluster avoid
// importing the concrete Plugin entity class (consumer-owns-view pattern).
interface PluginPlacementView {
    props: { team: string };
}

interface ResolvedPlacementDefinition {
    team: string;
    primaryClusterId: string;
    buckets: StoragePlacementBucketRef[];
}

// `@Singleton()` keeps the class self-registered under its own constructor so the
// existing consumers that inject it POSITIONALLY by class (no `@inject`) keep
// resolving the same shared singleton. `@AliasOf(COMPUTE_TOKENS.StoragePlacementService)`
// adds the neutral token binding (same `Symbol.for` resolution) so cross-module
// consumers can `@inject(COMPUTE_TOKENS.StoragePlacementService)` against the
// `IStoragePlacementService` port without importing this concrete class. NOTE:
// in this codebase `@Singleton(token)` registers ONLY under the token (see
// `decorators.ts`), so a bare `@Singleton(token)` here would have broken those
// positional-by-class injections — hence the Singleton + AliasOf pair.
@Singleton()
@AliasOf(COMPUTE_TOKENS.StoragePlacementService)
export default class StoragePlacementService implements IStoragePlacementService {
    constructor(
        @inject(CLUSTER_TOKENS.StoragePlacementRepository) private readonly storagePlacementRepository: IStoragePlacementRepository,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(COMPUTE_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository<PluginPlacementView>,
        @inject(COMPUTE_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService
    ) {}

    async findByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement | null> {
        return this.storagePlacementRepository.findByScope(scopeType, scopeId);
    }

    async ensurePlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement> {
        const existingPlacement = await this.storagePlacementRepository.findByScope(scopeType, scopeId);
        const resolved = await this.resolvePlacementDefinition(scopeType, scopeId);
        return this.persistResolvedPlacement(scopeType, scopeId, existingPlacement, resolved);
    }

    // Merges a resolved placement definition over any existing placement and
    // upserts it. Shared by ensurePlacement() (single scope) and the batch
    // transfer-planning path so the merge semantics stay identical.
    private async persistResolvedPlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        existingPlacement: StoragePlacement | null,
        resolved: ResolvedPlacementDefinition
    ): Promise<StoragePlacement> {
        const nextPlacementProps = createStoragePlacementProps({
            team: existingPlacement?.props.team ?? resolved.team,
            scopeType,
            scopeId,
            // Persist the original primary owner once the placement exists.
            // Ownership changes must go through switchPrimaryCluster() so the
            // underlying bytes can be transferred before metadata flips.
            primaryClusterId: existingPlacement?.props.primaryClusterId ?? resolved.primaryClusterId,
            replicaClusterIds: existingPlacement?.props.replicaClusterIds ?? [],
            buckets: resolved.buckets,
            state: existingPlacement?.props.state ?? DEFAULT_STORAGE_PLACEMENT_STATE,
            lastVerifiedAt: existingPlacement?.props.lastVerifiedAt ?? null,
            bytesUsed: existingPlacement?.props.bytesUsed ?? null,
            lastAccessedAt: existingPlacement?.props.lastAccessedAt ?? null,
            createdAt: existingPlacement?.props.createdAt,
            updatedAt: new Date()
        });

        return this.storagePlacementRepository.upsertByScope(scopeType, scopeId, nextPlacementProps);
    }

    /**
     * Pins a plugin-binary placement to a specific cluster without resolving a
     * default storage owner. Used by registry installs where the chosen compute
     * cluster downloads and stores the binary in its own object store.
     */
    async assignPluginBinaryPlacement(
        pluginId: string,
        team: string,
        primaryClusterId: string
    ): Promise<StoragePlacement> {
        return this.storagePlacementRepository.upsertByScope('plugin-binary', pluginId, createStoragePlacementProps({
            team,
            scopeType: 'plugin-binary',
            scopeId: pluginId,
            primaryClusterId,
            buckets: buildPluginBinaryPlacementBuckets(pluginId),
            updatedAt: new Date()
        }));
    }

    async switchPrimaryCluster(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        primaryClusterId: string,
        options: {
            replicaClusterIds?: string[];
            state?: StoragePlacementState;
            lastVerifiedAt?: Date | null;
            bytesUsed?: number | null;
            lastAccessedAt?: Date | null;
        } = {}
    ): Promise<StoragePlacement> {
        const placement = await this.ensurePlacement(scopeType, scopeId);

        return this.storagePlacementRepository.upsertByScope(scopeType, scopeId, {
            ...placement.props,
            primaryClusterId,
            replicaClusterIds: options.replicaClusterIds ?? placement.props.replicaClusterIds,
            state: options.state ?? placement.props.state,
            lastVerifiedAt: options.lastVerifiedAt ?? placement.props.lastVerifiedAt,
            bytesUsed: options.bytesUsed ?? placement.props.bytesUsed,
            lastAccessedAt: options.lastAccessedAt ?? placement.props.lastAccessedAt,
            updatedAt: new Date()
        });
    }

    async setPlacementState(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        state: StoragePlacementState
    ): Promise<StoragePlacement> {
        const placement = await this.ensurePlacement(scopeType, scopeId);

        return this.storagePlacementRepository.upsertByScope(scopeType, scopeId, {
            ...placement.props,
            state,
            updatedAt: new Date()
        });
    }

    async synchronizeScopeStorageOwner(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        storageClusterId: string
    ): Promise<void> {
        if (scopeType === 'trajectory') {
            const analyses = await this.analysisRepository.export({
                filter: {
                    trajectory: scopeId
                },
                sort: {
                    createdAt: 1
                }
            });

            await Promise.all([
                this.trajectoryRepository.updateById(scopeId, {
                    storageClusterId
                }),
                this.analysisRepository.updateMany({
                    trajectory: scopeId
                }, {
                    storageClusterId
                }),
                this.sceneArtifactRepository.updateMany({
                    trajectory: scopeId
                }, {
                    storageClusterId
                })
            ]);
            await this.synchronizeAnalysisPlacementsForTrajectory(scopeId, analyses, storageClusterId);
            return;
        }

        if (scopeType === 'analysis') {
            await Promise.all([
                this.analysisRepository.updateById(scopeId, {
                    storageClusterId
                }),
                this.sceneArtifactRepository.updateMany({
                    analysis: scopeId
                }, {
                    storageClusterId
                })
            ]);
            return;
        }
    }

    async listByPrimaryClusterId(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]> {
        return this.storagePlacementRepository.listByPrimaryClusterId(teamId, primaryClusterId);
    }

    async resolveTransferPlacementsForCluster(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]> {
        const plannedPlacements = new Map<string, StoragePlacement>();
        const trajectoryTransferIds = new Set<string>();

        const trajectories = await this.trajectoryRepository.export({
            filter: {
                team: teamId,
                storageClusterId: primaryClusterId
            },
            sort: {
                createdAt: 1
            }
        });

        // Batch-load the existing trajectory placements once instead of a
        // findByScope round-trip per trajectory.
        const trajectoryPlacements = await this.loadPlacementsByScope(
            'trajectory',
            trajectories.map((trajectory) => trajectory._id)
        );

        for (const trajectory of trajectories) {
            // The trajectory is already loaded (exported above), so resolve its
            // placement definition directly instead of re-fetching by id.
            const placement = await this.persistResolvedPlacement(
                'trajectory',
                trajectory._id,
                trajectoryPlacements.get(trajectory._id) ?? null,
                this.resolveTrajectoryPlacementDefinition(trajectory)
            );
            if (placement.props.primaryClusterId !== primaryClusterId) {
                continue;
            }

            plannedPlacements.set(this.buildPlacementKey(placement.props.scopeType, placement.props.scopeId), placement);
            trajectoryTransferIds.add(trajectory._id);
        }

        // Push the source-cluster filter into the query so non-source-cluster
        // analyses are never loaded (the old post-load discard read the same
        // plain `storageClusterId` field this filter matches).
        const analyses = await this.analysisRepository.export({
            filter: {
                team: teamId,
                storageClusterId: primaryClusterId
            },
            sort: {
                createdAt: 1
            }
        });

        const candidateAnalyses = analyses.filter(
            (analysis) => !trajectoryTransferIds.has(analysis.props.trajectory)
        );

        const analysisPlacements = await this.loadPlacementsByScope(
            'analysis',
            candidateAnalyses.map((analysis) => analysis._id)
        );

        for (const analysis of candidateAnalyses) {
            const placement = await this.persistResolvedPlacement(
                'analysis',
                analysis._id,
                analysisPlacements.get(analysis._id) ?? null,
                this.resolveAnalysisPlacementDefinition(analysis)
            );
            if (placement.props.primaryClusterId !== primaryClusterId) {
                continue;
            }

            plannedPlacements.set(this.buildPlacementKey(placement.props.scopeType, placement.props.scopeId), placement);
        }

        return [...plannedPlacements.values()];
    }

    // Loads every existing placement for the given scope ids in a single query
    // (keyed by scopeId) so callers can avoid a findByScope round-trip per row.
    private async loadPlacementsByScope(
        scopeType: StoragePlacementScopeType,
        scopeIds: string[]
    ): Promise<Map<string, StoragePlacement>> {
        if (!scopeIds.length) {
            return new Map();
        }

        const placements = await this.storagePlacementRepository.export({
            filter: {
                scopeType,
                scopeId: {
                    $in: scopeIds
                }
            }
        });

        return new Map(placements.map((placement) => [placement.props.scopeId, placement]));
    }

    private async resolvePlacementDefinition(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<ResolvedPlacementDefinition> {
        if (scopeType === 'trajectory') {
            const trajectory = await this.trajectoryRepository.findById(scopeId);
            if (!trajectory) {
                throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found for storage placement');
            }

            return this.resolveTrajectoryPlacementDefinition(trajectory);
        }

        if (scopeType === 'analysis') {
            const analysis = await this.analysisRepository.findById(scopeId);
            if (!analysis) {
                throw ApplicationError.notFound('Analysis::NotFound', 'Analysis not found for storage placement');
            }

            return this.resolveAnalysisPlacementDefinition(analysis);
        }

        const plugin = await this.pluginRepository.findById(scopeId);
        if (!plugin) {
            throw ApplicationError.notFound('Plugin::NotFound', 'Plugin not found for storage placement');
        }

        const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(plugin.props.team);

        return {
            team: plugin.props.team,
            primaryClusterId: storageClusterId,
            buckets: buildPluginBinaryPlacementBuckets(scopeId)
        };
    }

    // Resolves a trajectory's placement definition from an already-loaded entity
    // (no findById). Shared by resolvePlacementDefinition and the batch path.
    private resolveTrajectoryPlacementDefinition(trajectory: TrajectoryLike): ResolvedPlacementDefinition {
        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'StoragePlacement::TrajectoryStorageClusterRequired',
                'Trajectory storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: trajectory.props.team,
            primaryClusterId: storageClusterId,
            buckets: buildTrajectoryPlacementBuckets(trajectory._id)
        };
    }

    // Resolves an analysis's placement definition from an already-loaded entity
    // (no findById). Shared by resolvePlacementDefinition and the batch path.
    private resolveAnalysisPlacementDefinition(analysis: Analysis): ResolvedPlacementDefinition {
        const storageClusterId = resolveAnalysisStorageClusterId(analysis.props);
        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'StoragePlacement::AnalysisStorageClusterRequired',
                'Analysis storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: analysis.props.team,
            primaryClusterId: storageClusterId,
            buckets: buildAnalysisPlacementBuckets(analysis.props.trajectory, analysis._id)
        };
    }

    private async synchronizeAnalysisPlacementsForTrajectory(
        trajectoryId: string,
        analyses: Analysis[],
        storageClusterId: string
    ): Promise<void> {
        for (const analysis of analyses) {
            const existingPlacement = await this.storagePlacementRepository.findByScope('analysis', analysis._id);
            const existingPrimaryClusterId = existingPlacement?.props.primaryClusterId;

            await this.storagePlacementRepository.upsertByScope('analysis', analysis._id, createStoragePlacementProps({
                team: analysis.props.team,
                scopeType: 'analysis',
                scopeId: analysis._id,
                primaryClusterId: storageClusterId,
                replicaClusterIds: existingPlacement?.props.replicaClusterIds.filter((clusterId) => {
                    return clusterId !== storageClusterId && clusterId !== existingPrimaryClusterId;
                }) ?? [],
                buckets: buildAnalysisPlacementBuckets(trajectoryId, analysis._id),
                state: 'active',
                lastVerifiedAt: existingPlacement?.props.lastVerifiedAt ?? null,
                bytesUsed: existingPlacement?.props.bytesUsed ?? null,
                lastAccessedAt: existingPlacement?.props.lastAccessedAt ?? null,
                createdAt: existingPlacement?.props.createdAt,
                updatedAt: new Date()
            }));
        }
    }

    private buildPlacementKey(scopeType: StoragePlacementScopeType, scopeId: string): string {
        return `${scopeType}:${scopeId}`;
    }
}
