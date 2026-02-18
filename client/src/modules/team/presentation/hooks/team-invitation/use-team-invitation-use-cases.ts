import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamInvitationRepository from '@/modules/team/domain/ports/ITeamInvitationRepository';

const useTeamInvitationUseCases = () => {
    return useMemo(() => ({
        teamInvitationRepository: container.resolve<ITeamInvitationRepository>(TEAM_TOKENS.TeamInvitationRepository)
    }), []);
};

export default useTeamInvitationUseCases;
