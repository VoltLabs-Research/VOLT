import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamRepository from '@/modules/team/domain/ports/ITeamRepository';
import type CreateTeamUseCase from '@/modules/team/application/use-cases/team/CreateTeamUseCase';

const useTeamUseCases = () => {
    return useMemo(() => ({
        createTeamUseCase: container.resolve<CreateTeamUseCase>(TEAM_TOKENS.CreateTeamUseCase),
        teamRepository: container.resolve<ITeamRepository>(TEAM_TOKENS.TeamRepository)
    }), []);
};

export default useTeamUseCases;
