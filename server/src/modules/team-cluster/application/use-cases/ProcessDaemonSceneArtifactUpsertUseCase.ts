import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { SceneArtifactParams, SceneArtifactSourceType, SceneArtifactStatus } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

export interface ProcessDaemonSceneArtifactUpsertInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    trajectory: string;
    teamCluster?: string;
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
};

interface ProcessDaemonSceneArtifactUpsertOutputDTO {
    acknowledged: boolean;
};

@injectable()
export default class ProcessDaemonSceneArtifactUpsertUseCase implements IUseCase<
    ProcessDaemonSceneArtifactUpsertInputDTO,
    ProcessDaemonSceneArtifactUpsertOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async execute(
        input: ProcessDaemonSceneArtifactUpsertInputDTO
    ): Promise<Result<ProcessDaemonSceneArtifactUpsertOutputDTO, ApplicationError>> {
        try {
            await this.teamClusterLifecycleService.authenticateDaemonConnection(
                input.teamClusterId,
                input.daemonPassword
            );

            const trajectory = await this.trajectoryRepository.findById(input.trajectory);
            if (!trajectory) {
                throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND', 'Trajectory not found');
            }

            if (trajectory.props.teamCluster && trajectory.props.teamCluster !== input.teamClusterId) {
                throw ApplicationError.forbidden(
                    'TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH',
                    'Trajectory does not belong to the authenticated team cluster'
                );
            }

            let sanitizedAnalysisId = input.analysis;
            let sanitizedPluginId = input.plugin;
            const sanitizedTeamClusterId = trajectory.props.teamCluster ?? input.teamClusterId;

            if (input.analysis) {
                const analysis = await this.analysisRepository.findById(input.analysis);
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

                if (analysis.props.teamCluster && analysis.props.teamCluster !== input.teamClusterId) {
                    throw ApplicationError.forbidden(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH',
                        'Analysis does not belong to the authenticated team cluster'
                    );
                }

                if (input.plugin && input.plugin !== analysis.props.plugin) {
                    throw ApplicationError.badRequest(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_PLUGIN_MISMATCH',
                        'Payload plugin does not match persisted analysis ownership'
                    );
                }

                sanitizedAnalysisId = analysis.id;
                sanitizedPluginId = analysis.props.plugin;
            }

            if (input.teamCluster && input.teamCluster !== sanitizedTeamClusterId) {
                throw ApplicationError.badRequest(
                    'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_CLUSTER_MISMATCH',
                    'Payload team cluster does not match persisted ownership'
                );
            }

            const existingArtifact = await this.sceneArtifactRepository.findOne({ objectName: input.objectName });
            if (existingArtifact) {
                if (existingArtifact.props.trajectory !== trajectory.id) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_TRAJECTORY_MISMATCH',
                        'Scene artifact object name is already associated with another trajectory'
                    );
                }

                if (existingArtifact.props.analysis && existingArtifact.props.analysis !== sanitizedAnalysisId) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_ANALYSIS_MISMATCH',
                        'Scene artifact object name is already associated with another analysis'
                    );
                }

                if (existingArtifact.props.teamCluster && existingArtifact.props.teamCluster !== sanitizedTeamClusterId) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_CLUSTER_CONFLICT',
                        'Scene artifact object name is already associated with another team cluster'
                    );
                }

                if (existingArtifact.props.plugin && sanitizedPluginId && existingArtifact.props.plugin !== sanitizedPluginId) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_PLUGIN_MISMATCH',
                        'Scene artifact object name is already associated with another plugin'
                    );
                }

                if (existingArtifact.props.sourceType !== input.sourceType) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_SOURCE_TYPE_MISMATCH',
                        'Scene artifact object name is already associated with another source type'
                    );
                }

                if (existingArtifact.props.timestep !== input.timestep) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_TIMESTEP_MISMATCH',
                        'Scene artifact object name is already associated with another timestep'
                    );
                }
            }

            await recordSceneArtifact(this.sceneArtifactRepository, {
                objectName: input.objectName,
                trajectory: trajectory.id,
                teamCluster: sanitizedTeamClusterId,
                analysis: sanitizedAnalysisId,
                plugin: sanitizedPluginId,
                sourceType: input.sourceType,
                timestep: input.timestep,
                params: input.params,
                displayName: input.displayName,
                status: input.status,
                storageBucket: input.storageBucket,
                metadata: input.metadata
            });

            return Result.ok({ acknowledged: true });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(
                ApplicationError.internalServerError('Failed to process daemon scene artifact upsert')
            );
        }
    }
};
