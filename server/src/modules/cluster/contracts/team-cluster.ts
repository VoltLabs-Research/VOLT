import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import type {
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterProps
} from '@shared/contracts/types/TeamCluster';

export interface TeamCluster {
    readonly _id: string;
    readonly id: string;
    props: TeamClusterProps;
    readonly effectiveCapabilities: TeamClusterEffectiveCapabilitiesProps;
}

export const toTeamClusterLike = (entity: TeamClusterEntity): TeamCluster => ({
    _id: entity.id,
    id: entity.id,
    props: {
        name: entity.name,
        team: entity.team,
        createdBy: entity.createdBy,
        status: entity.status,
        enrollmentTokenHash: entity.enrollmentTokenHash,
        installedVersion: entity.installedVersion,
        installRoot: entity.installRoot,
        lastHeartbeatAt: entity.lastHeartbeatAt,
        lastDisconnectAt: entity.lastDisconnectAt,
        services: entity.services,
        queueConcurrency: entity.queueConcurrency,
        queueScopeLimits: entity.queueScopeLimits,
        roleConfig: entity.roleConfig,
        isDemo: entity.isDemo,
        demoExpiresAt: entity.demoExpiresAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
    },
    effectiveCapabilities: entity.effectiveCapabilities
});

export const findTeamClusterByIdWithSensitiveData = async (teamClusterId: string): Promise<TeamCluster | null> => {
    const entity = await TeamClusterEntity.findOneBy({ id: teamClusterId });
    return entity ? toTeamClusterLike(entity) : null;
};
