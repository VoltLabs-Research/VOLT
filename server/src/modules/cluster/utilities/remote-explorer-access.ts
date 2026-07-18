import { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import { requireOwnedTeamCluster } from '@modules/cluster/utilities/team-cluster-ownership';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type TeamCluster from '@modules/cluster/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import type { ITeamClusterRemoteAccessSessionService } from '@modules/cluster/ports/ITeamClusterRemoteAccessSessionService';
import type { OwnedTeamClusterInput } from '@modules/cluster/utilities/team-cluster-ownership';

interface ValidateRemoteExplorerSessionInput extends OwnedTeamClusterInput {
    sessionId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    userId: string;
}

export interface RemoteExplorerPreflightContext {
    teamCluster: TeamCluster;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
}

export const validateRemoteExplorerSession = (
    sessionService: ITeamClusterRemoteAccessSessionService,
    input: ValidateRemoteExplorerSessionInput
): ApplicationError | null => {
    const sessionResult = sessionService.validateSession({
        sessionId: input.sessionId,
        userId: input.userId,
        teamId: input.teamId,
        teamClusterId: input.teamClusterId,
        target: input.target
    });

    return sessionResult instanceof Error ? sessionResult : null;
};

/**
 * Validates the shared remote explorer access pipeline and returns the
 * resolved cluster context used by explorer use cases.
 */
export const preflightRemoteExplorerAccess = async (
    repository: ITeamClusterRepository,
    sessionService: ITeamClusterRemoteAccessSessionService,
    input: ValidateRemoteExplorerSessionInput
): Promise<RemoteExplorerPreflightContext | ApplicationError> => {
    const teamCluster = await requireOwnedTeamCluster(repository, input);
    if (teamCluster instanceof ApplicationError) {
        return teamCluster;
    }

    const sessionError = validateRemoteExplorerSession(sessionService, input);
    if (sessionError) {
        return sessionError;
    }

    return {
        teamCluster,
        teamClusterId: input.teamClusterId,
        target: input.target
    };
};
