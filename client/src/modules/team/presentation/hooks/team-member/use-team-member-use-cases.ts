import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamMemberRepository from '@/modules/team/domain/ports/ITeamMemberRepository';

const useTeamMemberUseCases = () => {
    return useMemo(() => ({
        teamMemberRepository: container.resolve<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository)
    }), []);
};

export default useTeamMemberUseCases;
