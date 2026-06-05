import type { TeamClusterRemoteAccessSessionDTO, TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type ApplicationError from '@shared/application/errors/ApplicationError';

export interface CreateRemoteAccessSessionParams {
    userId: string;
    teamId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
}

export interface ValidateRemoteAccessSessionParams {
    sessionId: string;
    userId: string;
    teamId?: string;
    teamClusterId?: string;
    target?: TeamClusterRemoteAccessTargetDTO;
}

export interface StoredRemoteAccessSession extends TeamClusterRemoteAccessSessionDTO {
    userId: string;
    teamId: string;
}

export interface ITeamClusterRemoteAccessSessionService {
    createSession(params: CreateRemoteAccessSessionParams): TeamClusterRemoteAccessSessionDTO;
    validateSession(params: ValidateRemoteAccessSessionParams): StoredRemoteAccessSession | ApplicationError;
}
