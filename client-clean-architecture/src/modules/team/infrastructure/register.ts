import { registerTeamDependencies } from '../application/registry';
import { teamRepository, teamMemberRepository } from './index';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerTeamInfrastructure = (): void => {
    registerTeamDependencies({
        teamRepository,
        teamMemberRepository,
        socketService
    });
};
