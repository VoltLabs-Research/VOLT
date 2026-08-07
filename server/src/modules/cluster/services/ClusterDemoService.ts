import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike } from '@modules/cluster/contracts/team-cluster';
import demoClusterDeploymentService from '@modules/cluster/services/DemoClusterDeploymentService';
import type { DemoClusterPlaintextCredentials } from '@modules/cluster/services/DemoClusterDeploymentService';
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
    insertTeamCluster,
    TEAM_CLUSTER_NAME_CONFLICT_CODE
} from '@modules/cluster/services/TeamClusterFactory';
import { toTeamClusterViewFromEntity, type TeamClusterView } from '@modules/cluster/services/TeamClusterView';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import { In, Not } from 'typeorm';

const DEMO_CLUSTER_TTL_MINUTES = readNumberEnv('DEMO_CLUSTER_TTL_MINUTES', 30);

const NON_ACTIVE_DEMO_STATUSES: TeamClusterStatus[] = [
    TeamClusterStatus.Deleting,
    TeamClusterStatus.DeleteFailed
];

/** A team has at most one live demo; deleting ones no longer count as active. */
export const findActiveDemo = (teamId: string): Promise<TeamClusterEntity | null> => TeamClusterEntity.findOneBy({
    team: teamId,
    isDemo: true,
    status: Not(In(NON_ACTIVE_DEMO_STATUSES))
});

/**
 * The throwaway demo cluster a team can spin up to try VOLT: provisioning it with
 * generated credentials, reporting its remaining lease and tearing it down when
 * the lease expires or a real cluster replaces it.
 */
class ClusterDemoService {

    async provisionDemo(input: { teamId: string; userId: string }): Promise<{ teamCluster: TeamClusterView }> {
        const existingDemo = await findActiveDemo(input.teamId);
        if (existingDemo) {
            logger.info(`[ClusterDemoService.provisionDemo] Returning existing demo teamClusterId=${existingDemo.id} teamId=${input.teamId}`);
            return { teamCluster: toTeamClusterViewFromEntity(existingDemo) };
        }

        const credentials = this.#buildPlaintextCredentials();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DEMO_CLUSTER_TTL_MINUTES * 60_000);
        const teamClusterProps = buildTeamClusterProps({
            name: `Demo Cluster ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(credentials.enrollmentToken),
            services: await encryptTeamClusterServices({
                postgres: {
                    username: credentials.postgresUsername,
                    password: credentials.postgresPassword
                },
                daemon: { password: credentials.daemonPassword }
            }),
            isDemo: true,
            demoExpiresAt: expiresAt,
            now
        });

        let created: TeamClusterEntity;
        try {
            created = await insertTeamCluster(teamClusterProps);
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.code === TEAM_CLUSTER_NAME_CONFLICT_CODE) {
                const concurrentDemo = await findActiveDemo(input.teamId);
                if (concurrentDemo) {
                    return { teamCluster: toTeamClusterViewFromEntity(concurrentDemo) };
                }
            }

            logger.error(error, `[ClusterDemoService.provisionDemo] Failed to persist demo cluster teamId=${input.teamId}`);
            throw ApplicationError.internalServerError('Failed to provision demo cluster');
        }

        logger.info(`[ClusterDemoService.provisionDemo] Demo cluster persisted teamClusterId=${created.id} teamId=${input.teamId} expiresAt=${expiresAt.toISOString()}`);

        void demoClusterDeploymentService.deployDemoStack(toTeamClusterLike(created), credentials).catch((error: unknown) => {
            logger.error(error, `[ClusterDemoService.provisionDemo] Demo stack deploy failed teamClusterId=${created.id} teamId=${input.teamId}`);
        });

        return { teamCluster: toTeamClusterViewFromEntity(created) };
    }

    async deleteDemo(input: { teamId: string; userId: string }): Promise<{ teardownScheduled: boolean }> {
        const demo = await findActiveDemo(input.teamId);
        if (!demo) {
            return { teardownScheduled: false };
        }

        await this.#markDeleting(demo.id, 'deleteDemo');
        void this.#teardownStack(demo.id, input.teamId, 'deleteDemo');

        return { teardownScheduled: true };
    }

    async getDemoStatus(input: { teamId: string; userId: string }): Promise<{
        teamCluster: TeamClusterView | null;
        remainingMs: number | null;
        hasActiveDemo: boolean;
    }> {
        const demo = await findActiveDemo(input.teamId);
        if (!demo) {
            return {
                teamCluster: null,
                remainingMs: null,
                hasActiveDemo: false
            };
        }

        const teamCluster = toTeamClusterViewFromEntity(demo);
        if (!demo.demoExpiresAt) {
            return {
                teamCluster,
                remainingMs: null,
                hasActiveDemo: true
            };
        }

        const remainingMs = demo.demoExpiresAt.getTime() - Date.now();
        if (remainingMs > 0) {
            return {
                teamCluster,
                remainingMs,
                hasActiveDemo: true
            };
        }

        void this.#retire(demo.id, input.teamId, 'getDemoStatus');

        return {
            teamCluster,
            remainingMs: 0,
            hasActiveDemo: false
        };
    }

    /** A team that provisions a real cluster no longer needs its demo stack running. */
    async retireDemoForNewCluster(teamId: string): Promise<void> {
        const existingDemo = await findActiveDemo(teamId);
        if (existingDemo) {
            void this.#retire(existingDemo.id, teamId, 'create');
        }
    }

    async #retire(teamClusterId: string, teamId: string, reason: string): Promise<void> {
        await this.#markDeleting(teamClusterId, reason);
        await this.#teardownStack(teamClusterId, teamId, reason);
    }

    async #markDeleting(teamClusterId: string, reason: string): Promise<void> {
        try {
            await teamClusterLifecycleService.markDeleting(teamClusterId);
        } catch (error: unknown) {
            logger.warn(`[ClusterDemoService.${reason}] markDeleting failed teamClusterId=${teamClusterId} error=${(error as Error).message}`);
        }
    }

    async #teardownStack(teamClusterId: string, teamId: string, reason: string): Promise<void> {
        const teamCluster = await TeamClusterEntity.findOneBy({ id: teamClusterId });
        if (!teamCluster) {
            return;
        }

        try {
            await demoClusterDeploymentService.teardownDemoStack(toTeamClusterLike(teamCluster));
            await teamClusterLifecycleService.deleteTeamCluster(toTeamClusterLike(teamCluster));
            logger.info(`[ClusterDemoService.${reason}] Demo cleaned up teamClusterId=${teamClusterId} teamId=${teamId}`);
        } catch (error: unknown) {
            logger.error(error, `[ClusterDemoService.${reason}] Demo teardown failed teamClusterId=${teamClusterId} teamId=${teamId}`);
        }
    }

    #buildPlaintextCredentials(): DemoClusterPlaintextCredentials {
        const postgres = createServiceCredentials('postgres');

        return {
            enrollmentToken: createEnrollmentToken(),
            postgresUsername: postgres.username,
            postgresPassword: postgres.password,
            daemonPassword: createDaemonPassword()
        };
    }
}

export default new ClusterDemoService();
