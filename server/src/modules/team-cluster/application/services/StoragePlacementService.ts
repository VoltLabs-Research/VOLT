import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { resolveAnalysisStorageClusterId, resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import {
    buildAnalysisPlacementBuckets,
    buildPluginBinaryPlacementBuckets,
    buildTrajectoryPlacementBuckets
} from '@modules/team-cluster/application/utilities/storage-placement-targets';
import StoragePlacement, {
    DEFAULT_STORAGE_PLACEMENT_STATE,
    createStoragePlacementProps
} from '@modules/team-cluster/domain/entities/StoragePlacement';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import type { StoragePlacementBucketRef, StoragePlacementScopeType, StoragePlacementState } from '@shared/infrastructure/contracts/team-cluster';
import type StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';

interface ResolvedPlacementDefinition {
    team: string;
    primaryClusterId: string;
    buckets: StoragePlacementBucketRef[];
}

@injectable()
export default class StoragePlacementService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementRepository)
        private readonly storagePlacementRepository: StoragePlacementRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
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
            team: resolved.team,
            scopeType,
            scopeId,
            primaryClusterId: resolved.primaryClusterId,
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

        const trajectoryMap = await this.buildTrajectoryMapForAnalyses(analyses, trajectories);

        for (const analysis of analyses) {
            const trajectory = trajectoryMap.get(analysis.props.trajectory);
            const resolvedStorageClusterId = resolveAnalysisStorageClusterId(analysis.props);

            if (resolvedStorageClusterId !== primaryClusterId) {
                continue;
            }

            if (trajectoryTransferIds.has(analysis.props.trajectory)) {
                continue;
            }

            const placement = await this.ensurePlacement('analysis', analysis.id);
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

            const trajectory = await this.trajectoryRepository.findById(analysis.props.trajectory);
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

        return {
            team: plugin.props.team,
            primaryClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
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
            const existingPlacement = await this.storagePlacementRepository.findByScope('analysis', analysis.id);
            const existingPrimaryClusterId = existingPlacement?.props.primaryClusterId;

            await this.storagePlacementRepository.upsertByScope('analysis', analysis.id, createStoragePlacementProps({
                team: analysis.props.team,
                scopeType: 'analysis',
                scopeId: analysis.id,
                primaryClusterId: storageClusterId,
                replicaClusterIds: existingPlacement?.props.replicaClusterIds.filter((clusterId) => {
                    return clusterId !== storageClusterId && clusterId !== existingPrimaryClusterId;
                }) ?? [],
                buckets: buildAnalysisPlacementBuckets(trajectoryId, analysis.id),
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
