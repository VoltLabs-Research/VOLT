import { ErrorCodes } from '@core/constants/error-codes';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import Analysis from '@modules/analysis/models/Analysis';
import { AnalysisArtifactStatus } from '@modules/analysis/contracts/analysis';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { toTrajectoryLike } from '@modules/trajectory/contracts/trajectory-like';
import teamClusterLifecycleService from '@modules/cluster/services/team-cluster/TeamClusterLifecycleService';
import type { TeamClusterDaemonSceneArtifactUpsertItem } from '@modules/cluster/socket/TeamClusterSocketProtocol';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { SceneArtifactBatchUpsertedArtifact } from '@shared/contracts/events';
import type { AnalysisExpectedArtifact } from '@shared/contracts/types';
import logger from '@shared/infrastructure/logger';

export type ProcessDaemonSceneArtifactUpsertInput = TeamClusterDaemonSceneArtifactUpsertItem & {
    teamClusterId: string;
    daemonPassword: string;
};

/** One accepted artifact, with ownership already resolved against the database. */
interface PreparedSceneArtifact {
    objectName: string;
    teamId: string;
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: TeamClusterDaemonSceneArtifactUpsertItem['sourceType'];
    timestep: number;
    params: TeamClusterDaemonSceneArtifactUpsertItem['params'];
    displayName: string;
    status: TeamClusterDaemonSceneArtifactUpsertItem['status'];
    storageBucket: string;
    metadata?: Record<string, unknown>;
}

const byKey = <T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> => {
    const groups = new Map<string, T[]>();

    for (const item of items) {
        const key = keyOf(item);
        const group = groups.get(key) ?? [];
        group.push(item);
        groups.set(key, group);
    }

    return groups;
};

/**
 * Ingests the scene artifacts a daemon reports after rendering: it authorises each
 * one against the trajectory/analysis it claims to belong to, upserts it by object
 * name, and advances the owning analysis towards `ready`.
 */
class DaemonSceneArtifactIngestService {
    async processBatch(inputs: ProcessDaemonSceneArtifactUpsertInput[]): Promise<{ acknowledged: boolean }> {
        const artifacts = await this.#authorize(inputs);
        if (artifacts.length) {
            await this.#upsertByObjectName(artifacts);
            await this.#markAnalysisArtifactsReady(artifacts);
            await this.#publishBatchUpserted(artifacts);
        }

        return { acknowledged: true };
    }

    /**
     * A daemon may only report artifacts for a trajectory (and analysis) whose
     * storage — or, for plugin exposures, compute — it actually owns.
     */
    async #authorize(inputs: ProcessDaemonSceneArtifactUpsertInput[]): Promise<PreparedSceneArtifact[]> {
        const [firstInput] = inputs;
        if (!firstInput) {
            return [];
        }

        for (const input of inputs) {
            if (input.teamClusterId !== firstInput.teamClusterId || input.daemonPassword !== firstInput.daemonPassword) {
                throw ApplicationError.badRequest(
                    ErrorCodes.TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_BATCH_AUTH_MISMATCH,
                    'All scene artifact upserts in a batch must share the same daemon credentials'
                );
            }
        }

        await teamClusterLifecycleService.authenticateDaemonConnection(firstInput.teamClusterId, firstInput.daemonPassword);

        const trajectoryById = new Map(await Promise.all(
            [...new Set(inputs.map((input) => input.trajectory))].map(async (trajectoryId) => {
                const entity = await Trajectory.findOneBy({ id: trajectoryId });
                return [trajectoryId, entity && toTrajectoryLike(entity)] as const;
            })
        ));
        const analysisById = new Map(await Promise.all(
            [...new Set(inputs.flatMap((input) => input.analysis ?? []))].map(async (analysisId) => {
                return [analysisId, await Analysis.findOneBy({ id: analysisId })] as const;
            })
        ));

        return inputs.map((input) => {
            const trajectory = trajectoryById.get(input.trajectory);
            if (!trajectory) {
                throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND, 'Trajectory not found');
            }

            const trajectoryStorageClusterId = trajectory.props.storageClusterId;
            if (!trajectoryStorageClusterId) {
                throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_DAEMON_TRAJECTORY_STORAGE_CLUSTER_REQUIRED, 'Trajectory storage cluster is required before accepting scene artifacts');
            }

            if (input.storageClusterId !== trajectoryStorageClusterId) {
                throw ApplicationError.forbidden(ErrorCodes.TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH, 'Reported storage cluster does not match the trajectory storage cluster');
            }

            const owned = {
                ...input,
                teamId: trajectory.props.team,
                trajectory: trajectory._id,
                storageClusterId: trajectoryStorageClusterId
            };

            if (!input.analysis) {
                if (input.teamClusterId !== trajectoryStorageClusterId) {
                    throw ApplicationError.forbidden(ErrorCodes.TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH, 'Trajectory storage does not belong to the authenticated team cluster');
                }

                return owned;
            }

            const analysis = analysisById.get(input.analysis);
            if (!analysis) {
                throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_NOT_FOUND, 'Analysis not found');
            }

            if (analysis.trajectory !== trajectory._id) {
                throw ApplicationError.badRequest(ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH, 'Analysis does not belong to the provided trajectory');
            }

            if (analysis.team !== trajectory.props.team) {
                throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH, 'Analysis ownership does not match its trajectory');
            }

            const analysisStorageClusterId = analysis.storageClusterId;
            if (!analysisStorageClusterId) {
                throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_STORAGE_CLUSTER_REQUIRED, 'Analysis storage cluster is required before accepting scene artifacts');
            }

            if (input.storageClusterId !== analysisStorageClusterId) {
                throw ApplicationError.forbidden(ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH, 'Reported storage cluster does not match the analysis storage cluster');
            }

            const isPluginExposure = input.sourceType === 'plugin-exposure';
            const isReporterAuthorized = input.teamClusterId === analysisStorageClusterId
                || (isPluginExposure && analysis.computeClusterId === input.teamClusterId);
            if (!isReporterAuthorized) {
                throw ApplicationError.forbidden(
                    ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH,
                    isPluginExposure
                        ? 'Plugin exposure artifacts must be reported by the analysis compute or storage cluster'
                        : 'Analysis storage does not belong to the authenticated team cluster'
                );
            }

            if (input.plugin && input.plugin !== analysis.plugin) {
                throw ApplicationError.badRequest(ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_PLUGIN_MISMATCH, 'Payload plugin does not match persisted analysis ownership');
            }

            return {
                ...owned,
                analysis: analysis.id,
                plugin: analysis.plugin,
                storageClusterId: analysisStorageClusterId
            };
        });
    }

    async #upsertByObjectName(artifacts: PreparedSceneArtifact[]): Promise<void> {
        for (const artifact of artifacts) {
            const { teamId: _teamId, ...columns } = artifact;

            try {
                const existing = await SceneArtifact.findOneBy({ objectName: artifact.objectName });
                await (existing
                    ? Object.assign(existing, columns).save()
                    : SceneArtifact.create({ ...columns }).save());
            } catch (error: unknown) {
                logger.warn(`[DaemonSceneArtifactIngest] Failed to upsert scene artifact objectName=${artifact.objectName} error=${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    async #publishBatchUpserted(artifacts: PreparedSceneArtifact[]): Promise<void> {
        const groups = byKey(artifacts, (artifact) => `${artifact.trajectory}::${artifact.analysis ?? ''}`);

        await Promise.all([...groups.values()].map((group) => {
            const [first] = group as [PreparedSceneArtifact, ...PreparedSceneArtifact[]];

            return eventBus.emit('scene-artifact.upserted', {
                teamId: first.teamId,
                trajectoryId: first.trajectory,
                analysisId: first.analysis,
                artifacts: group.map((artifact): SceneArtifactBatchUpsertedArtifact => ({
                    objectName: artifact.objectName,
                    trajectoryId: artifact.trajectory,
                    analysisId: artifact.analysis,
                    pluginId: artifact.plugin,
                    sourceType: artifact.sourceType,
                    timestep: artifact.timestep,
                    displayName: artifact.displayName,
                    status: artifact.status
                }))
            }).catch((err: unknown) => {
                logger.warn({
                    err,
                    trajectoryId: first.trajectory,
                    analysisId: first.analysis
                }, '[DaemonSceneArtifactIngest] Failed to publish scene-artifact.upserted');
            });
        }));
    }

    async #markAnalysisArtifactsReady(artifacts: PreparedSceneArtifact[]): Promise<void> {
        const exposureArtifacts = artifacts.filter((artifact) => artifact.analysis && artifact.sourceType === 'plugin-exposure');
        const groups = byKey(exposureArtifacts, (artifact) => artifact.analysis!);

        await Promise.all([...groups.entries()].map(async ([analysisId, group]) => {
            const analysis = await Analysis.findOneBy({ id: analysisId });
            if (!analysis) {
                return;
            }

            const expectedArtifacts = this.#applyReadyArtifacts(analysis.expectedArtifacts ?? [], group);
            const updated = await Object.assign(analysis, {
                expectedArtifacts,
                artifactStatus: expectedArtifacts.length > 0 && expectedArtifacts.every((artifact) => artifact.status === 'ready')
                    ? AnalysisArtifactStatus.Ready
                    : (analysis.artifactStatus ?? AnalysisArtifactStatus.Uploading)
            }).save();

            await eventBus.emit('analysis.stage.changed', {
                analysisId,
                teamId: group[0]!.teamId,
                trajectoryId: updated.trajectory,
                artifactStatus: updated.artifactStatus,
                expectedArtifacts: updated.expectedArtifacts,
                stages: updated.stages,
                childAnalyses: updated.childAnalyses
            }).catch((err: unknown) => {
                logger.warn({
                    err,
                    analysisId
                }, '[DaemonSceneArtifactIngest] Failed to publish analysis.stage.changed after artifact upsert');
            });
        }));
    }

    #applyReadyArtifacts(
        expectedArtifacts: AnalysisExpectedArtifact[],
        artifacts: PreparedSceneArtifact[]
    ): AnalysisExpectedArtifact[] {
        if (!expectedArtifacts.length) {
            return expectedArtifacts;
        }

        const byExposureId = new Map(artifacts.flatMap((artifact) => {
            const exposureId = artifact.params.exposureId;
            return exposureId ? [[exposureId, artifact] as const] : [];
        }));

        return expectedArtifacts.map((expected) => {
            const artifact = byExposureId.get(expected.exposureId);
            if (!artifact) {
                return expected;
            }

            const isReady = artifact.status === 'ready';

            return {
                ...expected,
                status: isReady ? 'ready' : 'failed',
                objectName: artifact.objectName,
                readyAt: isReady ? new Date() : expected.readyAt
            };
        });
    }
}

export default new DaemonSceneArtifactIngestService();
