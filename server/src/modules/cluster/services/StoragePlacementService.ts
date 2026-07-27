import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import { resolveAnalysisStorageClusterId } from '@shared/application/utilities/cluster-location';
import { getAnalysisStorageCleanupTargets } from '@shared/application/utilities/storage-cleanup-prefixes';
import { getTrajectoryStorageCleanupTargets } from '@shared/application/utilities/trajectory-storage-cleanup-prefixes';
import StoragePlacementModel, {
    DEFAULT_STORAGE_PLACEMENT_STATE,
    createStoragePlacementProps,
    toStoragePlacementLike,
    type StoragePlacement,
    type StoragePlacementDocument,
    type StoragePlacementProps
} from '@modules/cluster/models/StoragePlacementModel';
import AnalysisModel, { type AnalysisDocument } from '@modules/analysis/models/AnalysisModel';
import TrajectoryModel, { type TrajectoryDocument } from '@modules/trajectory/models/trajectory/TrajectoryModel';
import PluginModel from '@modules/plugin/models/plugin/PluginModel';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { StoragePlacementBucketRef, StoragePlacementScopeType, StoragePlacementState } from '@shared/domain/contracts/team-cluster';
import type { IStoragePlacementService } from '@shared/contracts/ports';
import type { FilterQuery, UpdateQuery } from 'mongoose';

const dedupeBucketRefs = (bucketRefs: StoragePlacementBucketRef[]): StoragePlacementBucketRef[] => {
    const deduped = new Map<string, StoragePlacementBucketRef>();

    for (const bucketRef of bucketRefs) {
        const key = `${bucketRef.bucket}:${bucketRef.prefix}`;
        if (!deduped.has(key)) {
            deduped.set(key, bucketRef);
        }
    }

    return [...deduped.values()];
};

export const buildTrajectoryPlacementBuckets = (trajectoryId: string): StoragePlacementBucketRef[] => {
    return dedupeBucketRefs(getTrajectoryStorageCleanupTargets(trajectoryId));
};

export const buildAnalysisPlacementBuckets = (
    trajectoryId: string,
    analysisId: string
): StoragePlacementBucketRef[] => {
    return dedupeBucketRefs(getAnalysisStorageCleanupTargets(trajectoryId, analysisId));
};

export const buildPluginBinaryPlacementBuckets = (pluginId: string): StoragePlacementBucketRef[] => {
    return [{
        bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
        prefix: `plugin-binaries/${pluginId}/`
    }];
};

interface ResolvedPlacementDefinition {
    team: string;
    primaryClusterId: string;
    buckets: StoragePlacementBucketRef[];
}

export class StoragePlacementService implements IStoragePlacementService {
    private readonly teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    async findByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement | null> {
        return this.findPlacementByScope(scopeType, scopeId);
    }

    async ensurePlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement> {
        const existingPlacement = await this.findPlacementByScope(scopeType, scopeId);
        const resolved = await this.resolvePlacementDefinition(scopeType, scopeId);
        return this.persistResolvedPlacement(scopeType, scopeId, existingPlacement, resolved);
    }

    private async findPlacementByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement | null> {
        const document = await StoragePlacementModel.findOne({
            scopeType,
            scopeId
        }).exec();

        return document ? toStoragePlacementLike(document) : null;
    }

    private async upsertPlacementByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        data: Partial<StoragePlacementProps>
    ): Promise<StoragePlacement> {
        const document = await StoragePlacementModel.findOneAndUpdate(
            {
                scopeType,
                scopeId
            },
            {
                $set: data
            } as UpdateQuery<StoragePlacementDocument>,
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        ).exec();

        return toStoragePlacementLike(document);
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

        return this.upsertPlacementByScope(scopeType, scopeId, nextPlacementProps);
    }

    async assignPluginBinaryPlacement(
        pluginId: string,
        team: string,
        primaryClusterId: string
    ): Promise<StoragePlacement> {
        return this.upsertPlacementByScope('plugin-binary', pluginId, createStoragePlacementProps({
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

        return this.upsertPlacementByScope(scopeType, scopeId, {
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

        return this.upsertPlacementByScope(scopeType, scopeId, {
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
            const analyses = await AnalysisModel.find({ trajectory: scopeId }).sort({ createdAt: 1 }).exec();

            await Promise.all([
                TrajectoryModel.findByIdAndUpdate(scopeId, {
                    $set: { storageClusterId }
                }).exec(),
                AnalysisModel.updateMany({
                    trajectory: scopeId
                }, {
                    $set: { storageClusterId }
                }).exec(),
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
                AnalysisModel.findByIdAndUpdate(scopeId, {
                    $set: { storageClusterId }
                }).exec(),
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
        const documents = await StoragePlacementModel.find({
            team: teamId,
            primaryClusterId
        }).sort({
            updatedAt: 1
        }).exec();

        return documents.map(toStoragePlacementLike);
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

        const analyses = await AnalysisModel.find({
            team: teamId,
            storageClusterId: primaryClusterId
        }).sort({ createdAt: 1 }).exec();

        const candidateAnalyses = analyses.filter(
            (analysis) => !trajectoryTransferIds.has(analysis.trajectory.toString())
        );

        const analysisPlacements = await this.loadPlacementsByScope(
            'analysis',
            candidateAnalyses.map((analysis) => analysis._id.toString())
        );

        for (const analysis of candidateAnalyses) {
            const analysisId = analysis._id.toString();
            const placement = await this.persistResolvedPlacement(
                'analysis',
                analysisId,
                analysisPlacements.get(analysisId) ?? null,
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

        const documents = await StoragePlacementModel.find({
            scopeType,
            scopeId: {
                $in: scopeIds
            }
        } as FilterQuery<StoragePlacementDocument>).exec();
        const placements = documents.map(toStoragePlacementLike);

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
            const analysis = await AnalysisModel.findById(scopeId);
            if (!analysis) {
                throw ApplicationError.notFound('Analysis::NotFound', 'Analysis not found for storage placement');
            }

            return this.resolveAnalysisPlacementDefinition(analysis);
        }

        const pluginDoc = await PluginModel.findById(scopeId).select('team').exec();
        if (!pluginDoc) {
            throw ApplicationError.notFound('Plugin::NotFound', 'Plugin not found for storage placement');
        }

        const pluginTeamId = String(pluginDoc.team);
        const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(pluginTeamId);

        return {
            team: pluginTeamId,
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

    private resolveAnalysisPlacementDefinition(analysis: AnalysisDocument): ResolvedPlacementDefinition {
        const storageClusterId = resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId?.toString() });
        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'StoragePlacement::AnalysisStorageClusterRequired',
                'Analysis storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: analysis.team.toString(),
            primaryClusterId: storageClusterId,
            buckets: buildAnalysisPlacementBuckets(analysis.trajectory.toString(), analysis._id.toString())
        };
    }

    private async synchronizeAnalysisPlacementsForTrajectory(
        trajectoryId: string,
        analyses: AnalysisDocument[],
        storageClusterId: string
    ): Promise<void> {
        for (const analysis of analyses) {
            const analysisId = analysis._id.toString();
            const existingPlacement = await this.findPlacementByScope('analysis', analysisId);
            const existingPrimaryClusterId = existingPlacement?.props.primaryClusterId;

            await this.upsertPlacementByScope('analysis', analysisId, createStoragePlacementProps({
                team: analysis.team.toString(),
                scopeType: 'analysis',
                scopeId: analysisId,
                primaryClusterId: storageClusterId,
                replicaClusterIds: existingPlacement?.props.replicaClusterIds.filter((clusterId) => {
                    return clusterId !== storageClusterId && clusterId !== existingPrimaryClusterId;
                }) ?? [],
                buckets: buildAnalysisPlacementBuckets(trajectoryId, analysisId),
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
