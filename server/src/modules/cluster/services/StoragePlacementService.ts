import type {
    IAnalysisRepository,
    ITeamClusterSelectionService,
    IStoragePlacementRepository
} from '@shared/contracts/ports';
import type { Analysis } from '@shared/contracts/types';
import type { IPluginRepository } from '@shared/contracts/ports';
import { resolveAnalysisStorageClusterId } from '@shared/application/utilities/cluster-location';
import {
    buildAnalysisPlacementBuckets,
    buildPluginBinaryPlacementBuckets,
    buildTrajectoryPlacementBuckets
} from '@modules/cluster/utilities/storage-placement-targets';
import StoragePlacement, {
    DEFAULT_STORAGE_PLACEMENT_STATE,
    createStoragePlacementProps
} from '@modules/cluster/entities/StoragePlacement';
import StoragePlacementRepository from '@modules/cluster/repositories/StoragePlacementRepository';
import AnalysisRepository from '@modules/analysis/repositories/AnalysisRepository';
import TrajectoryModel, { type TrajectoryDocument } from '@modules/trajectory/models/trajectory/TrajectoryModel';
import PluginRepository from '@modules/plugin/services/PluginRepository';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import { TeamClusterSelectionService } from '@modules/container/services/TeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { StoragePlacementBucketRef, StoragePlacementScopeType, StoragePlacementState } from '@shared/domain/contracts/team-cluster';
import type { IStoragePlacementService } from '@shared/contracts/ports';
import { container } from 'tsyringe';

interface PluginPlacementView {
    props: { team: string };
}

interface ResolvedPlacementDefinition {
    team: string;
    primaryClusterId: string;
    buckets: StoragePlacementBucketRef[];
}

export class StoragePlacementService implements IStoragePlacementService {
    private readonly storagePlacementRepository: IStoragePlacementRepository = new StoragePlacementRepository();
    private readonly analysisRepository: IAnalysisRepository = new AnalysisRepository();
    private readonly pluginRepository = new PluginRepository() as unknown as IPluginRepository<PluginPlacementView>;
    #teamClusterSelectionServiceCache?: ITeamClusterSelectionService;
    private get teamClusterSelectionService(): ITeamClusterSelectionService {
        return (this.#teamClusterSelectionServiceCache ??= container.resolve<ITeamClusterSelectionService>(TeamClusterSelectionService));
    }

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
                TrajectoryModel.findByIdAndUpdate(scopeId, {
                    $set: { storageClusterId }
                }).exec(),
                this.analysisRepository.updateMany({
                    trajectory: scopeId
                }, {
                    storageClusterId
                }),
                SceneArtifactModel.updateMany({
                    trajectory: scopeId
                }, {
                    $set: { storageClusterId }
                }).exec()
            ]);
            await this.synchronizeAnalysisPlacementsForTrajectory(scopeId, analyses, storageClusterId);
            return;
        }

        if (scopeType === 'analysis') {
            await Promise.all([
                this.analysisRepository.updateById(scopeId, {
                    storageClusterId
                }),
                SceneArtifactModel.updateMany({
                    analysis: scopeId
                }, {
                    $set: { storageClusterId }
                }).exec()
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

        const trajectories = await TrajectoryModel.find({
            team: teamId,
            storageClusterId: primaryClusterId
        }).sort({ createdAt: 1 }).exec();

        const trajectoryPlacements = await this.loadPlacementsByScope(
            'trajectory',
            trajectories.map((trajectory) => trajectory._id.toString())
        );

        for (const trajectory of trajectories) {
            const trajectoryId = trajectory._id.toString();
            const placement = await this.persistResolvedPlacement(
                'trajectory',
                trajectoryId,
                trajectoryPlacements.get(trajectoryId) ?? null,
                this.resolveTrajectoryPlacementDefinition(trajectory)
            );
            if (placement.props.primaryClusterId !== primaryClusterId) {
                continue;
            }

            plannedPlacements.set(this.buildPlacementKey(placement.props.scopeType, placement.props.scopeId), placement);
            trajectoryTransferIds.add(trajectoryId);
        }

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
            const trajectory = await TrajectoryModel.findById(scopeId);
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

    private resolveTrajectoryPlacementDefinition(trajectory: TrajectoryDocument): ResolvedPlacementDefinition {
        const storageClusterId = trajectory.storageClusterId?.toString();
        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'StoragePlacement::TrajectoryStorageClusterRequired',
                'Trajectory storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: trajectory.team.toString(),
            primaryClusterId: storageClusterId,
            buckets: buildTrajectoryPlacementBuckets(trajectory._id.toString())
        };
    }

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

export default new StoragePlacementService();
