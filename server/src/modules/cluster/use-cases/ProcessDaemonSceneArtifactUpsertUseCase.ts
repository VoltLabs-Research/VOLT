import type {
    ISceneArtifactRepository,
    ITrajectoryRepository,
    IAnalysisRepository
} from '@shared/contracts/ports';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@shared/application/utilities/cluster-location';
import type { ITeamClusterLifecycleService } from '@modules/cluster/ports/ITeamClusterLifecycleService';
import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import type { SceneArtifactBatchUpsertedArtifact } from '@shared/contracts/events';
import { GenericDomainEvent } from '@shared/domain/events/GenericDomainEvent';
import { DOMAIN_EVENTS } from '@shared/contracts/events';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';
import type { AnalysisExpectedArtifact } from '@shared/contracts/types';
import type { SceneArtifactParams, SceneArtifactSourceType, SceneArtifactStatus } from '@shared/contracts/types';
import type { IEventBus } from '@shared/application/events/IEventBus';

export interface ProcessDaemonSceneArtifactUpsertInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: SceneArtifactStatus;
    metadata?: Record<string, unknown>;
}

interface ProcessDaemonSceneArtifactUpsertOutputDTO {
    acknowledged: boolean;
}

interface PreparedSceneArtifactUpsertEntry {
    objectName: string;
    teamId: string;
    data: {
        trajectory: string;
        storageClusterId: string;
        analysis?: string;
        plugin?: string;
        sourceType: SceneArtifactSourceType;
        timestep: number;
        params: SceneArtifactParams;
        displayName: string;
        status: SceneArtifactStatus;
        storageBucket: string;
        metadata?: Record<string, unknown>;
    };
}

@Singleton()
export default class ProcessDaemonSceneArtifactUpsertUseCase implements IUseCase<ProcessDaemonSceneArtifactUpsertInputDTO, ProcessDaemonSceneArtifactUpsertOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService,
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(COMPUTE_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(
        input: ProcessDaemonSceneArtifactUpsertInputDTO
    ): Promise<ProcessDaemonSceneArtifactUpsertOutputDTO> {
        try {
            const entries = await this.prepareUpsertEntries([input]);
            await this.sceneArtifactRepository.upsertManyByObjectName(entries);
            await this.markAnalysisArtifactsReady(entries);
            await this.publishBatchUpserted(entries);

            return { acknowledged: true };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process daemon scene artifact upsert');
        }
    }

    async executeBatch(
        inputs: ProcessDaemonSceneArtifactUpsertInputDTO[]
    ): Promise<ProcessDaemonSceneArtifactUpsertOutputDTO> {
        try {
            const entries = await this.prepareUpsertEntries(inputs);
            await this.sceneArtifactRepository.upsertManyByObjectName(entries);
            await this.markAnalysisArtifactsReady(entries);
            await this.publishBatchUpserted(entries);

            return { acknowledged: true };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process daemon scene artifact upsert batch');
        }
    }

    private async publishBatchUpserted(entries: PreparedSceneArtifactUpsertEntry[]): Promise<void> {
        if (!entries.length) {
            return;
        }

        const groups = new Map<string, { teamId: string; trajectoryId: string; analysisId?: string; artifacts: SceneArtifactBatchUpsertedArtifact[] }>();

        for (const entry of entries) {
            const key = `${entry.data.trajectory}::${entry.data.analysis ?? ''}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    teamId: entry.teamId,
                    trajectoryId: entry.data.trajectory,
                    analysisId: entry.data.analysis,
                    artifacts: []
                };
                groups.set(key, group);
            }
            group.artifacts.push({
                objectName: entry.objectName,
                trajectoryId: entry.data.trajectory,
                analysisId: entry.data.analysis,
                pluginId: entry.data.plugin,
                sourceType: entry.data.sourceType,
                timestep: entry.data.timestep,
                displayName: entry.data.displayName,
                status: entry.data.status
            });
        }

        await Promise.all(Array.from(groups.values()).map((group) =>
            this.eventBus.publish(new GenericDomainEvent(DOMAIN_EVENTS.SceneArtifactBatchUpserted, group)).catch((err) => {
                logger.warn({ err, trajectoryId: group.trajectoryId, analysisId: group.analysisId },
                    '[ProcessDaemonSceneArtifactUpsertUseCase] Failed to publish scene-artifact.upserted');
            })
        ));
    }

    private async markAnalysisArtifactsReady(entries: PreparedSceneArtifactUpsertEntry[]): Promise<void> {
        const grouped = new Map<string, PreparedSceneArtifactUpsertEntry[]>();
        for (const entry of entries) {
            if (!entry.data.analysis || entry.data.sourceType !== 'plugin-exposure') {
                continue;
            }

            const group = grouped.get(entry.data.analysis) ?? [];
            group.push(entry);
            grouped.set(entry.data.analysis, group);
        }

        await Promise.all(Array.from(grouped.entries()).map(async ([analysisId, group]) => {
            const analysis = await this.analysisRepository.findById(analysisId);
            if (!analysis) {
                return;
            }

            const expectedArtifacts = this.updateExpectedArtifacts(
                analysis.props.expectedArtifacts ?? [],
                group
            );
            const artifactStatus = expectedArtifacts.length > 0
                && expectedArtifacts.every((artifact) => artifact.status === 'ready')
                ? 'ready'
                : (analysis.props.artifactStatus ?? 'uploading');

            const updatedAnalysis = await this.analysisRepository.updateById(analysisId, {
                expectedArtifacts,
                artifactStatus
            });
            if (!updatedAnalysis) {
                return;
            }

            await this.eventBus.publish(new GenericDomainEvent(DOMAIN_EVENTS.AnalysisStageChanged, {
                analysisId,
                teamId: group[0]!.teamId,
                trajectoryId: updatedAnalysis.props.trajectory,
                artifactStatus: updatedAnalysis.props.artifactStatus,
                expectedArtifacts: updatedAnalysis.props.expectedArtifacts,
                stages: updatedAnalysis.props.stages,
                childAnalyses: updatedAnalysis.props.childAnalyses
            })).catch((err) => {
                logger.warn({ err, analysisId },
                    '[ProcessDaemonSceneArtifactUpsertUseCase] Failed to publish analysis.stage.changed after artifact upsert');
            });
        }));
    }

    private updateExpectedArtifacts(
        expectedArtifacts: AnalysisExpectedArtifact[],
        entries: PreparedSceneArtifactUpsertEntry[]
    ): AnalysisExpectedArtifact[] {
        if (!expectedArtifacts.length) {
            return expectedArtifacts;
        }

        const byExposureId = new Map<string, PreparedSceneArtifactUpsertEntry>();
        for (const entry of entries) {
            const exposureId = entry.data.params.exposureId;
            if (typeof exposureId === 'string' && exposureId.length > 0) {
                byExposureId.set(exposureId, entry);
            }
        }

        return expectedArtifacts.map((artifact) => {
            const entry = byExposureId.get(artifact.exposureId);
            if (!entry) {
                return artifact;
            }

            return {
                ...artifact,
                status: entry.data.status === 'ready' ? 'ready' : 'failed',
                objectName: entry.objectName,
                readyAt: entry.data.status === 'ready' ? new Date() : artifact.readyAt
            };
        });
    }

    private async prepareUpsertEntries(
        inputs: ProcessDaemonSceneArtifactUpsertInputDTO[]
    ): Promise<PreparedSceneArtifactUpsertEntry[]> {
        if (!inputs.length) {
            return [];
        }

        const [firstInput] = inputs;
        if (!firstInput) {
            return [];
        }

        for (const input of inputs) {
            if (input.teamClusterId !== firstInput.teamClusterId || input.daemonPassword !== firstInput.daemonPassword) {
                throw ApplicationError.badRequest(
                    'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_BATCH_AUTH_MISMATCH',
                    'All scene artifact upserts in a batch must share the same daemon credentials'
                );
            }
        }

        await this.teamClusterLifecycleService.authenticateDaemonConnection(
            firstInput.teamClusterId,
            firstInput.daemonPassword
        );

        const trajectoryIds = Array.from(new Set(inputs.map((input) => input.trajectory)));
        const trajectories = await Promise.all(
            trajectoryIds.map(async (trajectoryId) => {
                const trajectory = await this.trajectoryRepository.findById(trajectoryId);
                return [trajectoryId, trajectory] as const;
            })
        );
        const trajectoryById = new Map(trajectories);

        const analysisIds = Array.from(
            new Set(
                inputs
                    .map((input) => input.analysis)
                    .filter((analysisId): analysisId is string => typeof analysisId === 'string' && analysisId.length > 0)
            )
        );
        const analyses = await Promise.all(
            analysisIds.map(async (analysisId) => {
                const analysis = await this.analysisRepository.findById(analysisId);
                return [analysisId, analysis] as const;
            })
        );
        const analysisById = new Map(analyses);

        return inputs.map((input) => {
            const trajectory = trajectoryById.get(input.trajectory);
            if (!trajectory) {
                throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND', 'Trajectory not found');
            }

            const trajectoryStorageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
            if (!trajectoryStorageClusterId) {
                throw ApplicationError.conflict(
                    'TEAM_CLUSTER_DAEMON_TRAJECTORY_STORAGE_CLUSTER_REQUIRED',
                    'Trajectory storage cluster is required before accepting scene artifacts'
                );
            }

            if (input.storageClusterId !== trajectoryStorageClusterId) {
                throw ApplicationError.forbidden(
                    'TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH',
                    'Reported storage cluster does not match the trajectory storage cluster'
                );
            }

            let sanitizedAnalysisId = input.analysis;
            let sanitizedPluginId = input.plugin;
            let sanitizedStorageClusterId = trajectoryStorageClusterId;
            let isReporterAuthorized = input.teamClusterId === trajectoryStorageClusterId;

            if (input.analysis) {
                const analysis = analysisById.get(input.analysis);
                if (!analysis) {
                    throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_ANALYSIS_NOT_FOUND', 'Analysis not found');
                }

                if (analysis.props.trajectory !== trajectory.id) {
                    throw ApplicationError.badRequest(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH',
                        'Analysis does not belong to the provided trajectory'
                    );
                }

                if (analysis.props.team !== trajectory.props.team) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH',
                        'Analysis ownership does not match its trajectory'
                    );
                }

                const analysisStorageClusterId = resolveAnalysisStorageClusterId(analysis.props);
                if (!analysisStorageClusterId) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_STORAGE_CLUSTER_REQUIRED',
                        'Analysis storage cluster is required before accepting scene artifacts'
                    );
                }

                if (input.storageClusterId !== analysisStorageClusterId) {
                    throw ApplicationError.forbidden(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH',
                        'Reported storage cluster does not match the analysis storage cluster'
                    );
                }

                if (input.sourceType === 'plugin-exposure') {
                    const analysisComputeClusterId = resolveAnalysisComputeClusterId(analysis.props);
                    isReporterAuthorized = input.teamClusterId === analysisStorageClusterId
                        || (typeof analysisComputeClusterId === 'string' && analysisComputeClusterId === input.teamClusterId);
                } else {
                    isReporterAuthorized = input.teamClusterId === analysisStorageClusterId;
                }

                if (!isReporterAuthorized) {
                    throw ApplicationError.forbidden(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH',
                        input.sourceType === 'plugin-exposure'
                            ? 'Plugin exposure artifacts must be reported by the analysis compute or storage cluster'
                            : 'Analysis storage does not belong to the authenticated team cluster'
                    );
                }

                if (input.plugin && input.plugin !== analysis.props.plugin) {
                    throw ApplicationError.badRequest(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_PLUGIN_MISMATCH',
                        'Payload plugin does not match persisted analysis ownership'
                    );
                }

                sanitizedAnalysisId = analysis._id;
                sanitizedPluginId = analysis.props.plugin;
                sanitizedStorageClusterId = analysisStorageClusterId;
            }

            if (!isReporterAuthorized) {
                throw ApplicationError.forbidden(
                    'TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH',
                    'Trajectory storage does not belong to the authenticated team cluster'
                );
            }

            return {
                objectName: input.objectName,
                teamId: trajectory.props.team,
                data: {
                    trajectory: trajectory.id,
                    storageClusterId: sanitizedStorageClusterId,
                    analysis: sanitizedAnalysisId,
                    plugin: sanitizedPluginId,
                    sourceType: input.sourceType,
                    timestep: input.timestep,
                    params: input.params,
                    displayName: input.displayName,
                    status: input.status,
                    storageBucket: input.storageBucket,
                    metadata: input.metadata
                }
            };
        });
    }
};
