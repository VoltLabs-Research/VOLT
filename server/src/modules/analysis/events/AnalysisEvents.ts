import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import Analysis from '@modules/analysis/models/Analysis';
import AnalysisService from '@modules/analysis/services/AnalysisService';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import { StoragePlacementScopeType } from '@modules/cluster/contracts/storage-placement';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import { getAnalysisStorageCleanupTargets } from '@shared/application/utilities/storage-cleanup-prefixes';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import redisClient from '@shared/infrastructure/redis/redisClient';
import logger from '@shared/infrastructure/logger';
import type { FindOptionsWhere } from 'typeorm';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const JOB_TOMBSTONE_KEY_PREFIX = 'jobs:removed:';

const DAEMON_LISTING_DOCUMENT_TYPES = ['listing', 'sub-listing'] as const;

@DefineEventGroup('analysis')
export default class AnalysisEvents{
    #service?: AnalysisService;

    @Event('analysis.deleted')
    async purgeJobsAndArtifacts(payload: EventMap['analysis.deleted']){
        const { analysisId, teamId } = payload;

        try{
            await teamJobMaintenanceService.cleanupDeletedAnalysis(payload);
        }catch(error){
            logger.warn(error, `[AnalysisEvents] Failed to purge running jobs for analysis ${analysisId}`);
        }

        try{
            await this.#removeProjectedJobHistory(analysisId, teamId);
        }catch(error){
            logger.warn(error, `[AnalysisEvents] Failed to remove projected job history for analysis ${analysisId}`);
        }

        try{
            await analysisExecutionLogService.clearRuntimeState(analysisId);
        }catch(error){
            logger.warn(error, `[AnalysisEvents] Failed to remove runtime frame logs for analysis ${analysisId}`);
        }

        await SceneArtifact.delete({ analysis: analysisId });
    }

    @Event('analysis.deleted')
    async cleanupStorage({ analysisId, trajectoryId, teamClusterId }: EventMap['analysis.deleted']){
        const targets = getAnalysisStorageCleanupTargets(trajectoryId, analysisId);

        if(!teamClusterId){
            logger.warn(
                `[AnalysisEvents] Skipping storage cleanup for analysis ${analysisId} because no storage cluster is assigned`
            );
        }

        await Promise.all([
            teamClusterId ? this.#deleteRemotePrefixes(teamClusterId, targets) : Promise.resolve(),
            StoragePlacement.delete({
                scopeType: StoragePlacementScopeType.Analysis,
                scopeId: analysisId
            }),
            ClusterTransferJob.delete({
                scopeType: StoragePlacementScopeType.Analysis,
                scopeId: analysisId
            })
        ]);
    }

    @Event('analysis.deleted')
    async purgeDaemonListings({ analysisId, teamClusterId }: EventMap['analysis.deleted']){
        if(!teamClusterId){
            return;
        }

        for(const documentType of DAEMON_LISTING_DOCUMENT_TYPES){
            try{
                await teamClusterDaemonClient.command(teamClusterId, ChannelCommands.PluginTransferMongoPurge, {
                    analysisIds: [analysisId],
                    documentType
                });
            }catch(error){
                logger.warn(
                    error,
                    `[AnalysisEvents] Failed to purge ${documentType} rows for analysis ${analysisId} on cluster ${teamClusterId}`
                );
            }
        }
    }

    @Event('team.deleted')
    async deleteTeamAnalyses({ teamId, userId }: EventMap['team.deleted']){
        await this.#deleteEach({ team: teamId }, teamId, userId);
    }

    @Event('trajectory.deleted')
    async deleteTrajectoryAnalyses({ trajectoryId, teamId, userId }: EventMap['trajectory.deleted']){
        await this.#deleteEach({ trajectory: trajectoryId }, teamId, userId);
    }

    async #deleteEach(where: FindOptionsWhere<Analysis>, teamId: string, userId?: string): Promise<void>{
        const analyses = await Analysis.find({
            where,
            select: { id: true }
        });
        this.#service ??= new AnalysisService();

        await cascadeDeleteEach({
            label: 'AnalysisEvents',
            ids: analyses.map((analysis) => analysis.id),
            deleteOne: async (analysisId) => {
                await this.#service!.deleteAnalysisById({
                    analysisId,
                    teamId,
                    userId
                });
            }
        });
    }

    async #deleteRemotePrefixes(
        teamClusterId: string,
        targets: ReturnType<typeof getAnalysisStorageCleanupTargets>
    ): Promise<void>{
        const results = await Promise.allSettled(
            targets.map((target) => objectGatewayClient.deleteByPrefix(teamClusterId, target.bucket, target.prefix))
        );

        results.forEach((result, index) => {
            if(result.status === 'rejected'){
                const target = targets[index];
                logger.warn(
                    result.reason,
                    `[AnalysisEvents] Failed to delete team cluster ${teamClusterId} storage prefix ${target.bucket}/${target.prefix}`
                );
            }
        });
    }

    async #removeProjectedJobHistory(analysisId: string, teamId: string): Promise<void>{
        const projectedAnalysisJobsKey = `analysis:${analysisId}:projected-jobs`;
        const terminalReceiptSetKey = `daemon-analysis:${analysisId}:terminal-keys`;

        const [jobIds, terminalKeys] = await Promise.all([
            redisClient.smembers(projectedAnalysisJobsKey),
            redisClient.smembers(terminalReceiptSetKey)
        ]);

        const pipeline = redisClient.pipeline();

        pipeline.del(projectedAnalysisJobsKey);
        pipeline.del(`daemon-analysis:${analysisId}:remaining`);
        pipeline.del(`daemon-analysis:${analysisId}:failed`);
        pipeline.del(terminalReceiptSetKey);

        for(const jobId of jobIds){
            pipeline.del(`${JOB_STATUS_KEY_PREFIX}${jobId}`);
            pipeline.del(`${JOB_TOMBSTONE_KEY_PREFIX}${jobId}`);

            if(teamId){
                pipeline.srem(`team:${teamId}:projected-jobs`, jobId);
            }
        }

        if(teamId){
            pipeline.incr(`team:${teamId}:projected-jobs:revision`);
        }

        for(const terminalKey of terminalKeys){
            pipeline.del(terminalKey);
        }

        await pipeline.exec();
    }
}
