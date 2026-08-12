import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
import { getAnalysisStorageCleanupTargets } from '@shared/application/utilities/storage-cleanup-prefixes';
import { getTrajectoryStorageCleanupTargets } from '@shared/application/utilities/trajectory-storage-cleanup-prefixes';
import StoragePlacementEntity from '@modules/cluster/models/StoragePlacement';
import {
    createStoragePlacementProps,
    toStoragePlacementLike,
    StoragePlacementScopeType as StoragePlacementScopeTypeColumn,
    StoragePlacementState as StoragePlacementStateColumn,
    type StoragePlacement,
    type StoragePlacementProps
} from '@modules/cluster/contracts/storage-placement';
import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import Plugin from '@modules/plugin/models/Plugin';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { isUniqueViolation } from '@shared/infrastructure/persistence/unique-violation';
import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType,
    StoragePlacementState
} from '@shared/domain/contracts/team-cluster';
import type { IStoragePlacementService } from '@shared/contracts/ports/IStoragePlacementService';
import { In } from 'typeorm';

const buildPluginBinaryPlacementBuckets = (pluginId: string): StoragePlacementBucketRef[] => [{
    bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
    prefix: `plugin-binaries/${pluginId}/`
}];

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
        const entity = await StoragePlacementEntity.findOneBy({
            scopeType: scopeType as StoragePlacementScopeTypeColumn,
            scopeId
        });

        return entity ? toStoragePlacementLike(entity) : null;
    }

    async ensurePlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement>{
        return this.persistResolvedPlacement(
            scopeType,
            scopeId,
            await this.findByScope(scopeType, scopeId),
            await this.resolvePlacementDefinition(scopeType, scopeId)
        );
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
        const scopeKey = {
            scopeType: scopeType as StoragePlacementScopeTypeColumn,
            scopeId
        };

        const existing = await StoragePlacementEntity.findOneBy(scopeKey);
        if(existing){
            return toStoragePlacementLike(await Object.assign(existing, patch).save());
        }

        try{
            return toStoragePlacementLike(await StoragePlacementEntity.create({
                ...patch,
                ...scopeKey
            }).save());
        }catch(error: unknown){
            if(!isUniqueViolation(error)) throw error;

            const winner = await StoragePlacementEntity.findOneBy(scopeKey);
            if(!winner) throw error;

            return toStoragePlacementLike(await Object.assign(winner, patch).save());
        }
    }

    private async persistResolvedPlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        existingPlacement: StoragePlacement | null,
        resolved: ResolvedPlacementDefinition
    ): Promise<StoragePlacement>{
        return this.upsertPlacementByScope(scopeType, scopeId, createStoragePlacementProps({
            ...existingPlacement?.props,
            team: existingPlacement?.props.team ?? resolved.team,
            scopeType,
            scopeId,
            primaryClusterId: existingPlacement?.props.primaryClusterId ?? resolved.primaryClusterId,
            buckets: resolved.buckets,
            updatedAt: new Date()
        }));
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

        return this.applyPlacementPatch(placement, {
            primaryClusterId,
            replicaClusterIds: options.replicaClusterIds ?? placement.props.replicaClusterIds,
            state: options.state ?? placement.props.state,
            lastVerifiedAt: options.lastVerifiedAt ?? placement.props.lastVerifiedAt,
            bytesUsed: options.bytesUsed ?? placement.props.bytesUsed,
            lastAccessedAt: options.lastAccessedAt ?? placement.props.lastAccessedAt
        });
    }

    async setPlacementState(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        state: StoragePlacementState
    ): Promise<StoragePlacement>{
        return this.applyPlacementPatch(await this.ensurePlacement(scopeType, scopeId), { state });
    }

    private async applyPlacementPatch(
        placement: StoragePlacement,
        patch: Partial<StoragePlacementProps>
    ): Promise<StoragePlacement>{
        return this.upsertPlacementByScope(placement.props.scopeType, placement.props.scopeId, {
            ...placement.props,
            ...patch,
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
            await this.synchronizeAnalysisPlacements(analyses, storageClusterId);
            return;
        }

        if(scopeType === 'analysis'){
            await Promise.all([
                Analysis.update({ id: scopeId }, { storageClusterId }),
                SceneArtifact.update({ analysis: scopeId }, { storageClusterId })
            ]);
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
        const trajectories = await Trajectory.find({
            where: {
                team: teamId,
                storageClusterId: primaryClusterId
            },
            order: { createdAt: 'ASC' }
        });
        const trajectoryPlacements = await this.collectOwnedPlacements(
            'trajectory',
            trajectories,
            primaryClusterId,
            (trajectory) => this.resolveTrajectoryPlacementDefinition(trajectory)
        );
        const movingTrajectoryIds = new Set(trajectoryPlacements.map((placement) => placement.props.scopeId));

        const analyses = await Analysis.find({
            where: {
                team: teamId,
                storageClusterId: primaryClusterId
            },
            order: { createdAt: 'ASC' }
        });
        const analysisPlacements = await this.collectOwnedPlacements(
            'analysis',
            analyses.filter((analysis) => !movingTrajectoryIds.has(analysis.trajectory)),
            primaryClusterId,
            (analysis) => this.resolveAnalysisPlacementDefinition(analysis)
        );

        return [...trajectoryPlacements, ...analysisPlacements];
    }

    private async collectOwnedPlacements<TScope extends { id: string; }>(
        scopeType: StoragePlacementScopeType,
        scopes: TScope[],
        primaryClusterId: string,
        resolveDefinition: (scope: TScope) => ResolvedPlacementDefinition
    ): Promise<StoragePlacement[]>{
        const existingPlacements = await this.loadPlacementsByScope(scopeType, scopes.map((scope) => scope.id));
        const ownedPlacements: StoragePlacement[] = [];

        for(const scope of scopes){
            const placement = await this.persistResolvedPlacement(
                scopeType,
                scope.id,
                existingPlacements.get(scope.id) ?? null,
                resolveDefinition(scope)
            );
            if(placement.props.primaryClusterId === primaryClusterId){
                ownedPlacements.push(placement);
            }
        }

        return ownedPlacements;
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

        return new Map(entities.map((entity) => {
            const placement = toStoragePlacementLike(entity);
            return [placement.props.scopeId, placement];
        }));
    }

    private async resolvePlacementDefinition(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<ResolvedPlacementDefinition>{
        if(scopeType === 'trajectory'){
            const trajectory = await Trajectory.findOneBy({ id: scopeId });
            if(!trajectory){
                throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found for storage placement');
            }

            return this.resolveTrajectoryPlacementDefinition(trajectory);
        }

        if(scopeType === 'analysis'){
            const analysis = await Analysis.findOneBy({ id: scopeId });
            if(!analysis){
                throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found for storage placement');
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
            throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found for storage placement');
        }

        return {
            team: plugin.team,
            primaryClusterId: await this.teamClusterSelectionService.resolveStorageClusterId(plugin.team),
            buckets: buildPluginBinaryPlacementBuckets(scopeId)
        };
    }

    private resolveTrajectoryPlacementDefinition(trajectory: Trajectory): ResolvedPlacementDefinition{
        const storageClusterId = trajectory.storageClusterId;
        if(!storageClusterId){
            throw ApplicationError.conflict(
                ErrorCodes.STORAGE_PLACEMENT_TRAJECTORY_STORAGE_CLUSTER_REQUIRED,
                'Trajectory storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: trajectory.team,
            primaryClusterId: storageClusterId,
            buckets: getTrajectoryStorageCleanupTargets(trajectory.id)
        };
    }

    private resolveAnalysisPlacementDefinition(analysis: Analysis): ResolvedPlacementDefinition{
        const storageClusterId = analysis.storageClusterId;
        if(!storageClusterId){
            throw ApplicationError.conflict(
                ErrorCodes.STORAGE_PLACEMENT_ANALYSIS_STORAGE_CLUSTER_REQUIRED,
                'Analysis storage cluster is required before creating a storage placement'
            );
        }

        return {
            team: analysis.team,
            primaryClusterId: storageClusterId,
            buckets: getAnalysisStorageCleanupTargets(analysis.trajectory, analysis.id)
        };
    }

    private async synchronizeAnalysisPlacements(
        analyses: Analysis[],
        storageClusterId: string
    ): Promise<void>{
        for(const analysis of analyses){
            const existingPlacement = await this.findByScope('analysis', analysis.id);
            const staleClusterIds = new Set([storageClusterId, existingPlacement?.props.primaryClusterId]);

            await this.upsertPlacementByScope('analysis', analysis.id, createStoragePlacementProps({
                ...existingPlacement?.props,
                team: analysis.team,
                scopeType: 'analysis',
                scopeId: analysis.id,
                primaryClusterId: storageClusterId,
                replicaClusterIds: existingPlacement?.props.replicaClusterIds.filter(
                    (clusterId) => !staleClusterIds.has(clusterId)
                ) ?? [],
                buckets: getAnalysisStorageCleanupTargets(analysis.trajectory, analysis.id),
                state: 'active',
                updatedAt: new Date()
            }));
        }
    }
}

export default new StoragePlacementService();
