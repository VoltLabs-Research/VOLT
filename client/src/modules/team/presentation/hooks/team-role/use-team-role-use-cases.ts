import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamRoleRepository from '@/modules/team/domain/ports/ITeamRoleRepository';

const useTeamRoleUseCases = () => {
    return useMemo(() => ({
        teamRoleRepository: container.resolve<ITeamRoleRepository>(TEAM_TOKENS.TeamRoleRepository)
    }), []);
};

export default useTeamRoleUseCases;
