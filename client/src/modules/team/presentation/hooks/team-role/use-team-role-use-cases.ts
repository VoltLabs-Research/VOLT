import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamRoleRepository from '@/modules/team/domain/ports/ITeamRoleRepository';

const useTeamRoleUseCases = createUseCasesHook({
    teamRoleRepository: TEAM_TOKENS.TeamRoleRepository
}) as () => {
    teamRoleRepository: ITeamRoleRepository;
};

export default useTeamRoleUseCases;
