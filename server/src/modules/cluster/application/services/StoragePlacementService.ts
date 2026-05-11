import type Analysis from '@modules/analysis/domain/entities/Analysis';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { resolveAnalysisStorageClusterId, resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import {
    buildAnalysisPlacementBuckets,
    buildPluginBinaryPlacementBuckets,
    buildTrajectoryPlacementBuckets
} from '@modules/cluster/application/utilities/storage-placement-targets';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import StoragePlacement, {
    DEFAULT_STORAGE_PLACEMENT_STATE,
    createStoragePlacementProps
} from '@modules/cluster/domain/entities/StoragePlacement';
import StoragePlacementRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { StoragePlacementBucketRef, StoragePlacementScopeType, StoragePlacementState } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface ResolvedPlacementDefinition {
    team: string;
    primaryClusterId: string;
    buckets: StoragePlacementBucketRef[];
}

@Singleton()
export default class StoragePlacementService {
    constructor(
        private readonly storagePlacementRepository: StoragePlacementRepository,
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly analysisRepository: AnalysisRepository,
        private readonly pluginRepository: PluginRepository,
        private readonly sceneArtifactRepository: SceneArtifactRepository,
        private readonly teamClusterSelectionService: TeamClusterSelectionService
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

        for (const trajectory of trajectories) {
            const placement = await this.ensurePlacement('trajectory', trajectory.id);
            if (placement.props.primaryClusterId !== primaryClusterId) {
                continue;
            }

            plannedPlacements.set(this.buildPlacementKey(placement.props.scopeType, placement.props.scopeId), placement);
            trajectoryTransferIds.add(trajectory.id);
        }

        const analyses = await this.analysisRepository.export({
            filter: {
                team: teamId
            },
            sort: {
                createdAt: 1
            }
        });

        await this.buildTrajectoryMapForAnalyses(analyses, trajectories);

        for (const analysis of analyses) {
            const resolvedStorageClusterId = resolveAnalysisStorageClusterId(analysis.props);

            if (resolvedStorageClusterId !== primaryClusterId) {
                continue;
            }

            if (trajectoryTransferIds.has(analysis.props.trajectory)) {
                continue;
            }

            const placement = await this.ensurePlacement('analysis', analysis._id);
            if (placement.props.primaryClusterId !== primaryClusterId) {
                continue;
            }

            plannedPlacements.set(this.buildPlacementKey(placement.props.scopeType, placement.props.scopeId), placement);
        }

        return [...plannedPlacements.values()];
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
                buckets: buildTrajectoryPlacementBuckets(scopeId)
            };
        }

        if (scopeType === 'analysis') {
            const analysis = await this.analysisRepository.findById(scopeId);
            if (!analysis) {
                throw ApplicationError.notFound('Analysis::NotFound', 'Analysis not found for storage placement');
            }

            await this.trajectoryRepository.findById(analysis.props.trajectory);
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
                buckets: buildAnalysisPlacementBuckets(analysis.props.trajectory, scopeId)
            };
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

    private async buildTrajectoryMapForAnalyses(
        analyses: Analysis[],
        knownTrajectories: Trajectory[]
    ): Promise<Map<string, Trajectory>> {
        const trajectoryMap = new Map<string, Trajectory>(
            knownTrajectories.map((trajectory) => [trajectory.id, trajectory])
        );
        const missingTrajectoryIds = [...new Set(
            analyses
                .map((analysis) => analysis.props.trajectory)
                .filter((trajectoryId) => typeof trajectoryId === 'string' && trajectoryId.length > 0)
                .filter((trajectoryId) => !trajectoryMap.has(trajectoryId))
        )];

        if (!missingTrajectoryIds.length) {
            return trajectoryMap;
        }

        const fetchedTrajectories = await this.trajectoryRepository.export({
            filter: {
                _id: {
                    $in: missingTrajectoryIds
                }
            }
        });

        for (const trajectory of fetchedTrajectories) {
            trajectoryMap.set(trajectory.id, trajectory);
        }

        return trajectoryMap;
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
