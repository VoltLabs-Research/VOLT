import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';
import { toTeamClusterLike } from '@modules/cluster/contracts/team-cluster';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import type { TeamClusterDaemonSemanticCommandResult } from '@modules/cluster/services/TeamClusterDaemonClient';
import clusterDemoService from '@modules/cluster/services/ClusterDemoService';
import {
    requireConfirmedPassword,
    requireOwnedTeamCluster
} from '@modules/cluster/services/cluster-access';
import DaemonCredentialGuard from '@modules/cluster/services/DaemonCredentialGuard';
import clusterTransferCoordinator from '@modules/cluster/services/ClusterTransferCoordinator';
import clusterTransferRunner from '@modules/cluster/services/ClusterTransferRunner';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import {
    createEnrollmentToken,
    hashEnrollmentToken
} from '@modules/cluster/services/TeamClusterCredentialService';
import {
    buildTeamClusterProps,
    createDaemonPassword,
    createServiceCredentials,
    encryptTeamClusterServices,
    insertTeamCluster
} from '@modules/cluster/services/TeamClusterFactory';
import { buildManualTeamClusterUninstallCommand } from '@modules/cluster/services/TeamClusterInstallRoot';
import {
    toClusterTransferJobViewFromDomain,
    toClusterTransferJobViewFromEntity,
    toTeamClusterViewFromEntity,
    type ClusterTransferJobView,
    type TeamClusterCredentialServicesView,
    type TeamClusterView
} from '@modules/cluster/services/TeamClusterView';
import {
    ClusterTransferJobState as ClusterTransferJobStateColumn,
    type ClusterTransferJob
} from '@modules/cluster/contracts/cluster-transfer-job';
import type { ClusterTransferJobState } from '@volt/contracts/modules/cluster/domain';
import type { StoragePlacement } from '@modules/cluster/contracts/storage-placement';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import logger from '@shared/infrastructure/logger';
import { ILike, In } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';

const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobStateColumn[] = [
    ClusterTransferJobStateColumn.Queued,
    ClusterTransferJobStateColumn.Freezing,
    ClusterTransferJobStateColumn.Copying,
    ClusterTransferJobStateColumn.Verifying,
    ClusterTransferJobStateColumn.Switching,
    ClusterTransferJobStateColumn.Cleaning
];

/** Enrollment may only be re-issued while nothing is installed and talking to us yet. */
const TOKEN_REGENERATION_STATUSES = new Set<TeamClusterStatus>([
    TeamClusterStatus.WaitingForConnection,
    TeamClusterStatus.HealthcheckReceived,
    TeamClusterStatus.PreparingEnvironment,
    TeamClusterStatus.Disconnected
]);

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

/**
 * Team-scoped lifecycle of a cluster registration: creating it, listing it with
 * its in-flight transfers, revealing or rotating its credentials, and removing it.
 * The runtime, demo, remote-explorer and daemon-facing concerns live in their own
 * services next to this one.
 */
export default class ClusterService {
    readonly #daemonCredentialGuard = new DaemonCredentialGuard();

    async create(input: { teamId: string; userId: string; name: string }): Promise<{
        teamCluster: TeamClusterView;
        enrollmentToken: string;
    }> {
        const name = input.name?.trim();
        if (!name) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_CLUSTER_NAME_REQUIRED, 'Cluster name is required');
        }

        const enrollmentToken = createEnrollmentToken();
        const teamClusterProps = buildTeamClusterProps({
            name,
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            services: await encryptTeamClusterServices({
                minio: createServiceCredentials('minio'),
                postgres: createServiceCredentials('postgres'),
                daemon: { password: createDaemonPassword() }
            }),
            isDemo: false,
            demoExpiresAt: null
        });

        let created: TeamClusterEntity;
        try {
            created = await insertTeamCluster(teamClusterProps);
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw ApplicationError.internalServerError('Failed to create team cluster');
        }

        logger.info(`Team cluster created teamClusterId=${created.id} teamId=${input.teamId} userId=${input.userId}`);

        void clusterDemoService.retireDemoForNewCluster(input.teamId);

        return {
            teamCluster: toTeamClusterViewFromEntity(created),
            enrollmentToken
        };
    }

    async listByTeamId(input: {
        teamId: string;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<PaginatedResult<TeamClusterView>> {
        const search = input.search?.trim();
        const containsSearch = search ? ILike(`%${escapeLikePattern(search)}%`) : undefined;
        const where: FindOptionsWhere<TeamClusterEntity> | FindOptionsWhere<TeamClusterEntity>[] = containsSearch
            ? [
                {
                    team: input.teamId,
                    name: containsSearch
                },
                {
                    team: input.teamId,
                    installedVersion: containsSearch
                },
                {
                    team: input.teamId,
                    id: containsSearch
                }
            ]
            : { team: input.teamId };

        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: 100 });
        const [entities, total] = await TeamClusterEntity.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });
        const activeTransfersByClusterId = await this.#findActiveTransfersByClusterId(
            input.teamId,
            entities.map((entity) => entity.id)
        );
        const data = entities.map((entity) => toTeamClusterViewFromEntity(entity, {
            activeTransfers: activeTransfersByClusterId.get(entity.id) ?? []
        }));

        return paginate([data, total], pageRequest);
    }

    async getById(input: { teamId: string; teamClusterId: string }): Promise<{ teamCluster: TeamClusterView }> {
        return { teamCluster: toTeamClusterViewFromEntity(await requireOwnedTeamCluster(input.teamClusterId, input.teamId)) };
    }

    async listTransferJobs(input: {
        teamId: string;
        teamClusterId: string;
        page?: number;
        limit?: number;
        state?: ClusterTransferJobState;
    }): Promise<PaginatedResult<ClusterTransferJobView>> {
        const teamCluster = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);
        const stateFilter = input.state === undefined
            ? {}
            : { state: input.state as ClusterTransferJobStateColumn };
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: 100 });

        const [entities, total] = await ClusterTransferJobEntity.findAndCount({
            where: [
                {
                    team: input.teamId,
                    sourceClusterId: teamCluster.id,
                    ...stateFilter
                },
                {
                    team: input.teamId,
                    destinationClusterId: teamCluster.id,
                    ...stateFilter
                }
            ],
            order: {
                createdAt: 'DESC',
                updatedAt: 'DESC'
            },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([entities.map(toClusterTransferJobViewFromEntity), total], pageRequest);
    }

    async createTransferRequest(input: {
        teamId: string;
        teamClusterId: string;
        destinationClusterId: string;
        authenticatedUserId: string;
    }): Promise<{
        message: string;
        sourceClusterId: string;
        destinationClusterId: string;
        requestedJobs: ClusterTransferJobView[];
    }> {
        const sourceCluster = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);
        const destinationCluster = await requireOwnedTeamCluster(input.destinationClusterId, input.teamId);

        if (sourceCluster.id === destinationCluster.id) {
            throw ApplicationError.conflict(ErrorCodes.CLUSTER_TRANSFER_DESTINATION_MUST_DIFFER, 'Destination cluster must be different from the source cluster');
        }

        if (sourceCluster.status !== TeamClusterStatus.Connected || !sourceCluster.effectiveCapabilities.servesStorageReads) {
            throw ApplicationError.conflict(ErrorCodes.CLUSTER_TRANSFER_SOURCE_CLUSTER_UNAVAILABLE, 'Source cluster must be connected and able to serve authoritative storage reads');
        }

        if (destinationCluster.status !== TeamClusterStatus.Connected || !destinationCluster.effectiveCapabilities.acceptsStorageWrites) {
            throw ApplicationError.conflict(ErrorCodes.CLUSTER_TRANSFER_DESTINATION_CLUSTER_UNAVAILABLE, 'Destination cluster must be connected and able to accept storage writes');
        }

        const placements: StoragePlacement[] = await storagePlacementService.resolveTransferPlacementsForCluster(
            input.teamId,
            sourceCluster.id
        );
        if (!placements.length) {
            throw ApplicationError.conflict(ErrorCodes.CLUSTER_TRANSFER_NO_PLACEMENTS, 'This cluster has no authoritative storage placements to transfer');
        }

        const requestedJobs: ClusterTransferJob[] = [];
        for (const placement of placements) {
            requestedJobs.push(await clusterTransferCoordinator.requestTransfer({
                teamId: input.teamId,
                scopeType: placement.props.scopeType,
                scopeId: placement.props.scopeId,
                destinationClusterId: destinationCluster.id,
                requestedBy: input.authenticatedUserId
            }));
        }

        clusterTransferRunner.kick(Math.min(Math.max(requestedJobs.length, 1), 10));

        return {
            message: requestedJobs.length === 1
                ? 'Queued 1 transfer job for this cluster.'
                : `Queued ${requestedJobs.length} transfer jobs for this cluster.`,
            sourceClusterId: sourceCluster.id,
            destinationClusterId: destinationCluster.id,
            requestedJobs: requestedJobs.map(toClusterTransferJobViewFromDomain)
        };
    }

    async revealCredentials(input: {
        teamId: string;
        teamClusterId: string;
        userId: string;
        password: string;
    }): Promise<{ teamClusterId: string; services: TeamClusterCredentialServicesView }> {
        const entity = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);
        await requireConfirmedPassword(input.userId, input.password);

        const services = entity.services;
        const decrypted = await this.#daemonCredentialGuard.getDecryptedServiceCredentials(toTeamClusterLike(entity));

        logger.info(`Team cluster credentials revealed teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

        return {
            teamClusterId: input.teamClusterId,
            services: {
                minio: {
                    port: services.minio.port,
                    username: decrypted.minioUsername,
                    password: decrypted.minioPassword
                },
                postgres: {
                    port: services.postgres.port,
                    username: decrypted.postgresUsername,
                    password: decrypted.postgresPassword
                },
                daemon: {
                    port: services.daemon.port,
                    password: decrypted.daemonPassword
                }
            }
        };
    }

    async regenerateEnrollmentToken(input: {
        teamId: string;
        userId: string;
        teamClusterId: string;
    }): Promise<{ enrollmentToken: string }> {
        const entity = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);

        if (!TOKEN_REGENERATION_STATUSES.has(entity.status)) {
            throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_INVALID_STATUS_FOR_TOKEN_REGENERATION, 'Enrollment token can only be regenerated for clusters in a waiting or disconnected state');
        }

        const enrollmentToken = createEnrollmentToken();
        await TeamClusterEntity.update({ id: input.teamClusterId }, {
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken)
        });

        logger.info(`Team cluster enrollment token regenerated teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

        return { enrollmentToken };
    }

    async deleteById(input: {
        teamId: string;
        teamClusterId: string;
        userId: string;
        password: string;
    }): Promise<{
        success: boolean;
        deleted: boolean;
        manualUninstallRequired: boolean;
        message: string;
        manualUninstallCommand?: string;
        teamCluster?: TeamClusterView;
    }> {
        const entity = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);
        await requireConfirmedPassword(input.userId, input.password);

        if (entity.status === TeamClusterStatus.Deleting) {
            throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_DELETION_ALREADY_IN_PROGRESS, 'Team cluster deletion is already in progress');
        }

        if (entity.status === TeamClusterStatus.Connected) {
            return {
                success: true,
                deleted: false,
                manualUninstallRequired: false,
                message: 'Remote uninstall requested. Volt will remove the cluster after the daemon confirms cleanup or the connection times out.',
                teamCluster: await this.#requestRemoteUninstall(input)
            };
        }

        const manualUninstallRequired = this.#shouldRequireManualUninstall(entity);

        await teamClusterLifecycleService.deleteTeamCluster(toTeamClusterLike(entity));

        logger.info(`Team cluster deleted without remote uninstall confirmation teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} manualUninstallRequired=${manualUninstallRequired}`);

        return {
            success: true,
            deleted: true,
            manualUninstallRequired,
            message: manualUninstallRequired
                ? 'Volt removed the cluster from the control plane. Remote uninstall could not be confirmed, so run the manual uninstall command on the host if the stack is still installed.'
                : 'Team cluster deleted from the control plane.',
            ...(manualUninstallRequired
                ? { manualUninstallCommand: buildManualTeamClusterUninstallCommand(entity.id, entity.installRoot) }
                : {})
        };
    }

    /** A connected cluster must tear its own stack down before we forget about it. */
    async #requestRemoteUninstall(input: {
        teamId: string;
        teamClusterId: string;
        userId: string;
    }): Promise<TeamClusterView> {
        let result: TeamClusterDaemonSemanticCommandResult<{ reason?: string; message?: string }>;

        try {
            result = await teamClusterDaemonClient.commandWithSemanticResult<{ reason?: string; message?: string }>(
                input.teamClusterId,
                ChannelCommands.RuntimeUninstall,
                { reason: `Delete requested by user ${input.userId}` },
                { timeoutClass: 'long-running-control-plane' }
            );
        } catch {
            logger.warn(`Failed to request remote team cluster uninstall teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

            throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_REMOTE_UNINSTALL_REQUEST_FAILED, 'Failed to request uninstall from the connected cluster daemon');
        }

        if (!result.accepted) {
            const rejectionReason = result.reason
                || result.data?.reason
                || result.data?.message
                || 'The daemon rejected the uninstall request.';

            logger.warn(`Cluster daemon rejected runtime.uninstall command teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} reason=${rejectionReason}`);

            throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_REMOTE_UNINSTALL_REJECTED, rejectionReason);
        }

        const updatedTeamCluster = await teamClusterLifecycleService.markDeleting(input.teamClusterId);

        logger.info(`Team cluster uninstall requested from daemon teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

        return updatedTeamCluster;
    }

    /** Anything that was ever installed, or is not provably connected, may still be running. */
    #shouldRequireManualUninstall(entity: TeamClusterEntity): boolean {
        if (entity.status === TeamClusterStatus.WaitingForConnection) {
            return entity.installedVersion !== null || entity.services.daemon.port !== null;
        }

        return entity.status !== TeamClusterStatus.Connected;
    }

    async #findActiveTransfersByClusterId(
        teamId: string,
        clusterIds: string[]
    ): Promise<Map<string, ClusterTransferJobView[]>> {
        const activeTransfersByClusterId = new Map<string, ClusterTransferJobView[]>();
        const clusterIdSet = new Set(clusterIds.filter(Boolean));
        if (clusterIdSet.size === 0) {
            return activeTransfersByClusterId;
        }

        const normalizedClusterIds = [...clusterIdSet];
        const activeTransferJobs = await ClusterTransferJobEntity.find({
            where: [
                {
                    team: teamId,
                    state: In(OPEN_TRANSFER_JOB_STATES),
                    sourceClusterId: In(normalizedClusterIds)
                },
                {
                    team: teamId,
                    state: In(OPEN_TRANSFER_JOB_STATES),
                    destinationClusterId: In(normalizedClusterIds)
                }
            ],
            order: {
                updatedAt: 'DESC',
                createdAt: 'DESC'
            }
        });

        for (const job of activeTransferJobs) {
            const jobView = toClusterTransferJobViewFromEntity(job);
            const endpoints = job.destinationClusterId === job.sourceClusterId
                ? [job.sourceClusterId]
                : [job.sourceClusterId, job.destinationClusterId];

            for (const clusterId of endpoints) {
                if (clusterIdSet.has(clusterId)) {
                    activeTransfersByClusterId.set(clusterId, [
                        ...activeTransfersByClusterId.get(clusterId) ?? [],
                        jobView
                    ]);
                }
            }
        }

        return activeTransfersByClusterId;
    }
}
