import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import { resolveAnalysisStorageClusterId } from '@shared/application/utilities/cluster-location';
import { getAnalysisStorageCleanupTargets } from '@shared/application/utilities/storage-cleanup-prefixes';
import { getTrajectoryStorageCleanupTargets } from '@shared/application/utilities/trajectory-storage-cleanup-prefixes';
import StoragePlacementEntity from '@modules/cluster/models/StoragePlacement';
import {
    DEFAULT_STORAGE_PLACEMENT_STATE,
    createStoragePlacementProps,
    toStoragePlacementLike,
    StoragePlacementScopeType as StoragePlacementScopeTypeColumn,
    StoragePlacementState as StoragePlacementStateColumn,
    type StoragePlacement,
    type StoragePlacementProps
} from '@modules/cluster/contracts/domain/storage-placement';
import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Plugin from '@modules/plugin/models/Plugin';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType,
    StoragePlacementState
} from '@shared/domain/contracts/team-cluster';
import type { IStoragePlacementService } from '@shared/contracts/ports';
import { In } from 'typeorm';

const dedupeBucketRefs = (bucketRefs: StoragePlacementBucketRef[]): StoragePlacementBucketRef[] => {
    const deduped = new Map<string, StoragePlacementBucketRef>();

    for(const bucketRef of bucketRefs){
        const key = `${bucketRef.bucket}:${bucketRef.prefix}`;
        if(!deduped.has(key)){
            deduped.set(key, bucketRef);
        }
    }

    return [...deduped.values()];
};

const buildTrajectoryPlacementBuckets = (trajectoryId: string): StoragePlacementBucketRef[] => {
    return dedupeBucketRefs(getTrajectoryStorageCleanupTargets(trajectoryId));
};

const buildAnalysisPlacementBuckets = (
    trajectoryId: string,
    analysisId: string
): StoragePlacementBucketRef[] => {
    return dedupeBucketRefs(getAnalysisStorageCleanupTargets(trajectoryId, analysisId));
};

const buildPluginBinaryPlacementBuckets = (pluginId: string): StoragePlacementBucketRef[] => {
    return [{
        bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
        prefix: `plugin-binaries/${pluginId}/`
    }];
};

interface ResolvedPlacementDefinition{
    team: string;
    primaryClusterId: string;
    buckets: StoragePlacementBucketRef[];
}

class StoragePlacementService implements IStoragePlacementService{
    private readonly teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    async findByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement | null>{
        return this.findPlacementByScope(scopeType, scopeId);
    }

    async ensurePlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement>{
        const existingPlacement = await this.findPlacementByScope(scopeType, scopeId);
        const resolved = await this.resolvePlacementDefinition(scopeType, scopeId);
        return this.persistResolvedPlacement(scopeType, scopeId, existingPlacement, resolved);
    }

    private async findPlacementByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement | null>{
        const entity = await StoragePlacementEntity.findOneBy({
            scopeType: scopeType as StoragePlacementScopeTypeColumn,
            scopeId
        });

        return entity ? toStoragePlacementLike(entity) : null;
    }

    private toEntityPatch(data: Partial<StoragePlacementProps>): Partial<StoragePlacementEntity>{
        const patch: Partial<StoragePlacementEntity> = {};

        if(data.team !== undefined) patch.team = data.team;
        if(data.scopeType !== undefined) patch.scopeType = data.scopeType as StoragePlacementScopeTypeColumn;
        if(data.scopeId !== undefined) patch.scopeId = data.scopeId;
        if(data.primaryClusterId !== undefined) patch.primaryClusterId = data.primaryClusterId;
        if(data.replicaClusterIds !== undefined) patch.replicaClusterIds = data.replicaClusterIds;
        if(data.buckets !== undefined) patch.buckets = data.buckets;
        if(data.state !== undefined) patch.state = data.state as StoragePlacementStateColumn;
        if(data.lastVerifiedAt !== undefined) patch.lastVerifiedAt = data.lastVerifiedAt;
        if(data.bytesUsed !== undefined) patch.bytesUsed = data.bytesUsed;
        if(data.lastAccessedAt !== undefined) patch.lastAccessedAt = data.lastAccessedAt;

        return patch;
    }

    private async upsertPlacementByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        data: Partial<StoragePlacementProps>
    ): Promise<StoragePlacement>{
        const patch = this.toEntityPatch(data);
        const existing = await StoragePlacementEntity.findOneBy({
            scopeType: scopeType as StoragePlacementScopeTypeColumn,
            scopeId
        });

        if(existing){
            return toStoragePlacementLike(await Object.assign(existing, patch).save());
        }

        const created = await StoragePlacementEntity.create({
            ...patch,
            scopeType: scopeType as StoragePlacementScopeTypeColumn,
            scopeId
        }).save();

        return toStoragePlacementLike(created);
    }

    private async persistResolvedPlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        existingPlacement: StoragePlacement | null,
        resolved: ResolvedPlacementDefinition
    ): Promise<StoragePlacement>{
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
    ): Promise<StoragePlacement>{
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
    ): Promise<StoragePlacement>{
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
    ): Promise<StoragePlacement>{
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
    ): Promise<void>{
        if(scopeType === 'trajectory'){
            const analyses = await Analysis.find({
                where: { trajectory: scopeId },
                order: { createdAt: 'ASC' }
            });

            await Promise.all([
                Trajectory.update({ id: scopeId }, { storageClusterId }),
                Analysis.update({ trajectory: scopeId }, { storageClusterId }),
                SceneArtifact.update({ trajectory: scopeId }, { storageClusterId })
            ]);
            await this.synchronizeAnalysisPlacementsForTrajectory(scopeId, analyses, storageClusterId);
            return;
        }

        if(scopeType === 'analysis'){
            await Promise.all([
                Analysis.update({ id: scopeId }, { storageClusterId }),
                SceneArtifact.update({ analysis: scopeId }, { storageClusterId })
            ]);
            return;
        }
    }

    async listByPrimaryClusterId(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]>{
        const entities = await StoragePlacementEntity.find({
            where: {
                team: teamId,
                primaryClusterId
            },
            order: { updatedAt: 'ASC' }
        });

        return entities.map(toStoragePlacementLike);
    }

    async resolveTransferPlacementsForCluster(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]>{
        const plannedPlacements = new Map<string, StoragePlacement>();
        const trajectoryTransferIds = new Set<string>();

        const trajectories = await Trajectory.find({
            where: {
                team: teamId,
                storageClusterId: primaryClusterId
            },
            order: { createdAt: 'ASC' }
        });

        const trajectoryPlacements = await this.loadPlacementsByScope(
            'trajectory',
            trajectories.map((trajectory) => trajectory.id)
        );

        for(const trajectory of trajectories){
            const trajectoryId = trajectory.id;
            const placement = await this.persistResolvedPlacement(
                'trajectory',
                trajectoryId,
                trajectoryPlacements.get(trajectoryId) ?? null,
                this.resolveTrajectoryPlacementDefinition(trajectory)
            );
            if(placement.props.primaryClusterId !== primaryClusterId){
                continue;
            }

            plannedPlacements.set(this.buildPlacementKey(placement.props.scopeType, placement.props.scopeId), placement);
            trajectoryTransferIds.add(trajectoryId);
        }

        const analyses = await Analysis.find({
            where: {
                team: teamId,
                storageClusterId: primaryClusterId
            },
            order: { createdAt: 'ASC' }
        });

        const candidateAnalyses = analyses.filter(
            (analysis) => !trajectoryTransferIds.has(analysis.trajectory)
        );

        const analysisPlacements = await this.loadPlacementsByScope(
            'analysis',
            candidateAnalyses.map((analysis) => analysis.id)
        );

        for(const analysis of candidateAnalyses){
            const analysisId = analysis.id;
            const placement = await this.persistResolvedPlacement(
                'analysis',
                analysisId,
                analysisPlacements.get(analysisId) ?? null,
                this.resolveAnalysisPlacementDefinition(analysis)
            );
            if(placement.props.primaryClusterId !== primaryClusterId){
                continue;
            }

            plannedPlacements.set(this.buildPlacementKey(placement.props.scopeType, placement.props.scopeId), placement);
        }

        return [...plannedPlacements.values()];
    }

    private async loadPlacementsByScope(
        scopeType: StoragePlacementScopeType,
        scopeIds: string[]
    ): Promise<Map<string, StoragePlacement>>{
        if(!scopeIds.length){
            return new Map();
        }

        const entities = await StoragePlacementEntity.findBy({
            scopeType: scopeType as StoragePlacementScopeTypeColumn,
            scopeId: In(scopeIds)
        });
        const placements = entities.map(toStoragePlacementLike);

        return new Map(placements.map((placement) => [placement.props.scopeId, placement]));
    }

    private async resolvePlacementDefinition(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<ResolvedPlacementDefinition>{
        if(scopeType === 'trajectory'){
            const trajectory = await Trajectory.findOneBy({ id: scopeId });
            if(!trajectory){
                throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found for storage placement');
            }

            return this.resolveTrajectoryPlacementDefinition(trajectory);
        }

        if(scopeType === 'analysis'){
            const analysis = await Analysis.findOneBy({ id: scopeId });
            if(!analysis){
                throw ApplicationError.notFound('Analysis::NotFound', 'Analysis not found for storage placement');
            }

            return this.resolveAnalysisPlacementDefinition(analysis);
        }

        const plugin = await Plugin.findOne({
            where: { id: scopeId },
            select: {
                id: true,
                team: true
            }
        });
        if(!plugin){
            throw ApplicationError.notFound('Plugin::NotFound', 'Plugin not found for storage placement');
        }

        const pluginTeamId = plugin.team;
        const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(pluginTeamId);

        return {
            team: pluginTeamId,
            primaryClusterId: storageClusterId,
            buckets: buildPluginBinaryPlacementBuckets(scopeId)
        };
    }

    private resolveTrajectoryPlacementDefinition(trajectory: Trajectory): ResolvedPlacementDefinition{
        const storageClusterId = trajectory.storageClusterId;
        if(!storageClusterId){
            throw ApplicationError.conflict(
                'StoragePlacement::TrajectoryStorageClusterRequired',
                'Trajectory storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: trajectory.team,
            primaryClusterId: storageClusterId,
            buckets: buildTrajectoryPlacementBuckets(trajectory.id)
        };
    }

    private resolveAnalysisPlacementDefinition(analysis: Analysis): ResolvedPlacementDefinition{
        const storageClusterId = resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId ?? undefined });
        if(!storageClusterId){
            throw ApplicationError.conflict(
                'StoragePlacement::AnalysisStorageClusterRequired',
                'Analysis storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: analysis.team,
            primaryClusterId: storageClusterId,
            buckets: buildAnalysisPlacementBuckets(analysis.trajectory, analysis.id)
        };
    }

    private async synchronizeAnalysisPlacementsForTrajectory(
        trajectoryId: string,
        analyses: Analysis[],
        storageClusterId: string
    ): Promise<void>{
        for(const analysis of analyses){
            const analysisId = analysis.id;
            const existingPlacement = await this.findPlacementByScope('analysis', analysisId);
            const existingPrimaryClusterId = existingPlacement?.props.primaryClusterId;

            await this.upsertPlacementByScope('analysis', analysisId, createStoragePlacementProps({
                team: analysis.team,
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

    private buildPlacementKey(scopeType: StoragePlacementScopeType, scopeId: string): string{
        return `${scopeType}:${scopeId}`;
    }
}

export default new StoragePlacementService();
